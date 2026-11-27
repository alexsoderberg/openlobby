import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ApiProvider,
  type ApiClient,
  type Game,
  type Item,
} from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { GamesPage } from "./GamesPage";

const wow: Game = {
  id: "g1",
  name: "WoW",
  defaultMaxPlayers: null,
  genre: null,
  gameRoles: [],
  modes: [
    {
      id: "m1",
      name: "Dungeon",
      maxPlayers: 5,
      gameRoles: [],
      activities: [
        { id: "a1", name: "Deadmines" },
        { id: "a2", name: "Stockade" },
      ],
    },
  ],
};

const known: Item = { itemId: 1935, name: "Assassin's Blade", status: "known" };
const unknown: Item = { itemId: 999999, name: null, status: "unknown" };
const unavailable: Item = { itemId: 872, name: null, status: "unavailable" };

/** The drop list of each activity as the server keeps it. */
function listsOf(lists: Record<string, Item[]>): Partial<ApiClient> {
  return {
    listGameItems: vi.fn((_gameId: string, filter?: { activityId?: string }) =>
      Promise.resolve({
        items: (lists[filter?.activityId ?? ""] ?? []).map((item) => ({
          ...item,
          dropsIn: [],
        })),
        nameSearchComplete: true,
      }),
    ),
  };
}

async function openDungeon(overrides: Partial<ApiClient>) {
  const client = fakeApiClient({
    listGames: vi.fn(() => Promise.resolve([wow])),
    ...overrides,
  });
  render(
    <ApiProvider client={client}>
      <GamesPage isSystemAdmin onUnauthenticated={vi.fn()} />
    </ApiProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: `${en.gameEdit}, WoW` }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Dungeon/ }));
  return client;
}

const dropList = (activity: string) =>
  screen.getByRole("group", { name: en.dropListHeading(activity) });

const itemField = (activity: string) =>
  within(dropList(activity)).getByLabelText(en.dropListItemIdLabel);

function addItem(activity: string, text: string) {
  fireEvent.change(itemField(activity), { target: { value: text } });
  fireEvent.click(
    within(dropList(activity)).getByRole("button", {
      name: en.dropListAdd,
    }),
  );
}

describe("drop list", () => {
  it("shows each item with its icon, name and ID, or the fallback of its status", async () => {
    await openDungeon(listsOf({ a1: [known, unknown, unavailable] }));

    const list = within(await within(dropList("Deadmines")).findByRole("list"));
    const rows = list.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Assassin's Blade"),
      expect.stringContaining(en.itemUnknown),
      expect.stringContaining(en.itemNameUnavailable),
    ]);
    expect(rows[0].textContent).toContain(en.itemId(1935));
    expect(rows[1].textContent).toContain(en.itemId(999999));
    expect(rows[2].textContent).toContain(en.itemFallbackName);
    expect(rows[2].textContent).toContain(en.itemId(872));
    // Only a known item has an icon; it is decorative, the name is text beside it.
    expect(rows[0].querySelector("img")?.getAttribute("src")).toBe(
      "/api/items/1935/icon",
    );
    expect(rows[0].querySelector("img")?.getAttribute("alt")).toBe("");
    expect(rows[1].querySelector("img")).toBeNull();
    expect(rows[2].querySelector("img")).toBeNull();
  });

  it("hides an item icon that fails to load and keeps the name", async () => {
    await openDungeon(listsOf({ a1: [known] }));
    const row = await within(dropList("Deadmines")).findByRole("listitem");

    fireEvent.error(row.querySelector("img")!);

    expect(row.querySelector("img")).toBeNull();
    expect(row.textContent).toContain("Assassin's Blade");
  });

  it("shows the attribution once on the page", async () => {
    await openDungeon(listsOf({ a1: [known], a2: [unknown] }));
    await within(dropList("Stockade")).findByRole("listitem");

    expect(screen.getAllByText(en.attribution)).toHaveLength(1);
  });

  it("says when a drop list has no items", async () => {
    await openDungeon(listsOf({}));

    expect(
      await within(dropList("Deadmines")).findByText(en.dropListEmpty),
    ).toBeTruthy();
  });

  it("shows a failed load with a way to try again", async () => {
    const listGameItems = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValue({ items: [], nameSearchComplete: true });
    await openDungeon({ listGameItems });
    const block = await waitFor(() => dropList("Deadmines"));

    fireEvent.click(
      (await within(block).findAllByRole("button", { name: en.tryAgain }))[0],
    );

    expect(await within(block).findByText(en.dropListEmpty)).toBeTruthy();
  });

  it("shows the whole list when an add came before a successful load", async () => {
    const listGameItems = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValue({
        items: [known, unknown].map((item) => ({ ...item, dropsIn: [] })),
        nameSearchComplete: true,
      });
    await openDungeon({
      listGameItems,
      addDropItem: vi.fn(() => Promise.resolve(unknown)),
    });
    const block = await waitFor(() => dropList("Deadmines"));
    await within(block).findAllByRole("button", { name: en.tryAgain });

    addItem("Deadmines", "999999");

    await waitFor(() =>
      expect(within(block).getAllByRole("listitem")).toHaveLength(2),
    );
    expect(within(block).getAllByRole("listitem")[0].textContent).toContain(
      "Assassin's Blade",
    );
  });

  it("refuses an item ID that is not a whole number from 1 to 2147483647 without sending it", async () => {
    const addDropItem = vi.fn();
    await openDungeon({ ...listsOf({}), addDropItem });
    await within(dropList("Deadmines")).findByText(en.dropListEmpty);

    for (const text of ["", "0", "1.5", "2147483648"]) {
      addItem("Deadmines", text);
      expect(within(dropList("Deadmines")).getByRole("alert").textContent).toBe(
        en.errors.invalid_item,
      );
      expect(itemField("Deadmines").getAttribute("aria-invalid")).toBe("true");
    }
    expect(addDropItem).not.toHaveBeenCalled();
  });

  it("adds an item at the end of the list and says so", async () => {
    const addDropItem = vi.fn(() => Promise.resolve(known));
    await openDungeon({ ...listsOf({ a1: [unavailable] }), addDropItem });
    await within(dropList("Deadmines")).findByRole("listitem");

    addItem("Deadmines", " 1935 ");

    await within(dropList("Deadmines")).findByText(en.dropListAdded);
    expect(addDropItem).toHaveBeenCalledWith("g1", "a1", 1935);
    const rows = within(dropList("Deadmines")).getAllByRole("listitem");
    expect(rows[1].textContent).toContain("Assassin's Blade");
    expect(itemField("Deadmines")).toHaveProperty("value", "");
  });

  it("adds an item when Enter is pressed in the field, without saving the game", async () => {
    const addDropItem = vi.fn(() => Promise.resolve(known));
    const client = await openDungeon({ ...listsOf({}), addDropItem });
    await within(dropList("Deadmines")).findByText(en.dropListEmpty);

    fireEvent.change(itemField("Deadmines"), { target: { value: "1935" } });
    fireEvent.keyDown(itemField("Deadmines"), { key: "Enter" });

    await within(dropList("Deadmines")).findByText(en.dropListAdded);
    expect(client.replaceGame).not.toHaveBeenCalled();
  });

  it("says that Blizzard does not know an added ID, and keeps it as Unknown item", async () => {
    await openDungeon({
      ...listsOf({}),
      addDropItem: vi.fn(() => Promise.resolve(unknown)),
    });
    await within(dropList("Deadmines")).findByText(en.dropListEmpty);

    addItem("Deadmines", "999999");

    expect(
      await within(dropList("Deadmines")).findByText(en.dropListAddedUnknown),
    ).toBeTruthy();
    expect(
      within(dropList("Deadmines")).getByRole("listitem").textContent,
    ).toContain(en.itemUnknown);
  });

  it("shows a refusal of the server next to the field", async () => {
    await openDungeon({
      ...listsOf({ a1: [known] }),
      addDropItem: vi.fn(() =>
        Promise.reject(new ApiError(409, "drop_item_taken")),
      ),
    });
    await within(dropList("Deadmines")).findByRole("listitem");

    addItem("Deadmines", "1935");

    expect(
      (await within(dropList("Deadmines")).findByRole("alert")).textContent,
    ).toBe(en.errors.drop_item_taken);
    expect(itemField("Deadmines")).toHaveProperty("value", "1935");
    expect(within(dropList("Deadmines")).getAllByRole("listitem")).toHaveLength(
      1,
    );
  });

  it("removes an item only after confirmation", async () => {
    const removeDropItem = vi.fn(() => Promise.resolve());
    await openDungeon({ ...listsOf({ a1: [known, unknown] }), removeDropItem });
    const block = dropList("Deadmines");
    await within(block).findAllByRole("listitem");

    fireEvent.click(
      within(block).getByRole("button", {
        name: `${en.dropListRemove}, ${en.itemUnknown} ${en.itemId(999999)}`,
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: en.dropListRemoveKeep }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: en.dropListRemoveSubmit }),
    );

    await waitFor(() =>
      expect(within(block).getAllByRole("listitem")).toHaveLength(1),
    );
    expect(removeDropItem).toHaveBeenCalledWith("g1", "a1", 999999);
    expect(within(block).getByText(en.dropListRemoved)).toBeTruthy();
  });

  it("keeps the item when the removal is not confirmed", async () => {
    const removeDropItem = vi.fn();
    await openDungeon({ ...listsOf({ a1: [known] }), removeDropItem });
    const block = dropList("Deadmines");
    await within(block).findByRole("listitem");

    fireEvent.click(
      within(block).getByRole("button", {
        name: new RegExp(en.dropListRemove),
      }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: en.dropListRemoveKeep,
      }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(removeDropItem).not.toHaveBeenCalled();
    expect(within(block).getAllByRole("listitem")).toHaveLength(1);
  });

  it("offers no drop list and no drop list hint in the form that adds a game", async () => {
    await openDungeon(listsOf({}));
    const addForm = screen
      .getByRole("heading", { name: en.gameAddHeading })
      .closest("section")!;
    fireEvent.click(
      within(addForm).getByRole("button", { name: en.gameModeAdd }),
    );
    fireEvent.click(
      within(addForm).getByRole("button", { name: en.gameActivityAdd }),
    );

    expect(
      within(addForm).queryByText(
        en.dropListAfterSave(en.gameEditSubmit, en.gameEdit),
      ),
    ).toBeNull();
    expect(
      within(addForm).queryByRole("group", { name: /Drop list/ }),
    ).toBeNull();
  });

  it("offers no drop list for an activity that is not saved yet, and says why", async () => {
    await openDungeon(listsOf({}));
    fireEvent.click(screen.getByRole("button", { name: en.gameActivityAdd }));

    expect(screen.getAllByRole("group", { name: /Drop list/ })).toHaveLength(2);
    // The reason sits with the new activity, where its drop list will be.
    const reason = screen.getByText(
      en.dropListAfterSave(en.gameEditSubmit, en.gameEdit),
    );
    expect(
      within(reason.closest("li")!).getByLabelText(en.gameActivityNameLabel),
    ).toHaveProperty("value", "");
  });
});
