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
  type GameGoals,
  type GameItem,
} from "../../api";
import { en } from "../../i18n/messages/en";
import { chooseOption } from "../../test/chooseOption";
import { fakeApiClient } from "../../test/fakeApiClient";
import { findToast } from "../../test/toasts";
import { Toaster } from "../../ui";
import { GoalsSection } from "./Goals";

const deadmines = {
  activityId: "a1",
  activityName: "Deadmines",
  modeName: "Dungeon",
};
const stockade = {
  activityId: "a2",
  activityName: "Stockade",
  modeName: "Dungeon",
};
const blade: GameItem = {
  itemId: 1935,
  name: "Assassin's Blade",
  status: "known",
  dropsIn: [deadmines, stockade],
};
const unknown: GameItem = {
  itemId: 999999,
  name: null,
  status: "unknown",
  dropsIn: [],
};
const unavailable: GameItem = {
  itemId: 872,
  name: null,
  status: "unavailable",
  dropsIn: [deadmines],
};
const cleaver: GameItem = {
  itemId: 5191,
  name: "Cruel Barb",
  status: "known",
  dropsIn: [stockade],
};

const wow: GameGoals = {
  gameId: "g1",
  gameName: "WoW",
  gameLogoVersion: null,
  goals: [unavailable, blade, unknown],
};
const chess: GameGoals = {
  gameId: "g2",
  gameName: "Chess",
  gameLogoVersion: null,
  goals: [],
};

function renderGoals(overrides: Partial<ApiClient> = {}) {
  const client = fakeApiClient({
    getGoals: vi.fn(() => Promise.resolve([wow, chess])),
    listGameItems: vi.fn(() =>
      Promise.resolve({
        items: [blade, cleaver, unavailable],
        nameSearchComplete: true,
      }),
    ),
    ...overrides,
  });
  render(
    <ApiProvider client={client}>
      <GoalsSection onUnauthenticated={vi.fn()} />
      <Toaster />
    </ApiProvider>,
  );
  return client;
}

const wowGoals = () =>
  screen.findByRole("list", { name: en.goals.listLabel("WoW") });

async function openPanel(game = "WoW") {
  fireEvent.click(
    await screen.findByRole("button", { name: `${en.goals.add}, ${game}` }),
  );
  return screen.getByRole("group", { name: en.goals.panelLabel(game) });
}

describe("GoalsSection", () => {
  it("lists each game's goals with the three name statuses and where they drop, and credits Blizzard once", async () => {
    renderGoals();

    const list = await wowGoals();
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining(en.itemFallbackName),
      expect.stringContaining("Assassin's Blade"),
      expect.stringContaining(en.itemUnknown),
    ]);
    expect(rows[0].textContent).toContain(en.itemNameUnavailable);
    expect(rows[1].textContent).toContain(
      en.goals.dropsIn(["Deadmines", "Stockade"]),
    );
    expect(rows[2].textContent).toContain(en.goals.onNoDropList);
    expect(
      screen.getByRole("heading", { level: 3, name: "Chess" }),
    ).toBeTruthy();
    expect(screen.getByText(en.goals.none)).toBeTruthy();
    expect(screen.getAllByText(en.attribution)).toHaveLength(1);
  });

  it("says so when no game has a drop list, without the attribution", async () => {
    renderGoals({ getGoals: () => Promise.resolve([]) });

    expect(await screen.findByText(en.goals.empty)).toBeTruthy();
    expect(screen.queryByText(en.attribution)).toBeNull();
  });

  it("credits Blizzard only once an item is on screen: a goal, or the open panel's results", async () => {
    renderGoals({ getGoals: () => Promise.resolve([chess]) });

    await screen.findByText(en.goals.none);
    expect(screen.queryByText(en.attribution)).toBeNull();
    await openPanel("Chess");
    expect(screen.getAllByText(en.attribution)).toHaveLength(1);
  });

  it("removes a goal at once, without a confirmation, and confirms it with a toast", async () => {
    const client = renderGoals();

    fireEvent.click(
      within(await wowGoals()).getByRole("button", {
        name: `${en.goals.remove}, Assassin's Blade`,
      }),
    );

    await findToast(en.goals.removed("Assassin's Blade"));
    expect(client.removeGoal).toHaveBeenCalledWith("g1", 1935);
    expect(within(await wowGoals()).queryByText("Assassin's Blade")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows a refused removal and keeps the goal", async () => {
    renderGoals({
      removeGoal: () =>
        Promise.reject(new ApiError(503, "service_unavailable")),
    });

    fireEvent.click(
      within(await wowGoals()).getByRole("button", {
        name: `${en.goals.remove}, Assassin's Blade`,
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    expect(within(await wowGoals()).getByText("Assassin's Blade")).toBeTruthy();
  });

  it("marks the results that are already goals and adds another with a toast", async () => {
    const client = renderGoals();

    const panel = await openPanel();
    expect(document.activeElement).toBe(
      within(panel).getByLabelText(en.goals.searchLabel),
    );
    await within(panel).findByText(en.goals.resultCount(3));
    const rows = within(panel).getAllByRole("listitem");
    expect(rows[0].textContent).toContain(en.goals.alreadyAdded);
    expect(rows[2].textContent).toContain(en.goals.alreadyAdded);

    fireEvent.click(
      within(rows[1]).getByRole("button", {
        name: `${en.goals.add}, Cruel Barb`,
      }),
    );

    await findToast(en.goals.added("Cruel Barb"));
    expect(client.addGoal).toHaveBeenCalledWith("g1", 5191);
    expect(within(rows[1]).getByText(en.goals.alreadyAdded)).toBeTruthy();
    expect(within(await wowGoals()).getByText("Cruel Barb")).toBeTruthy();
  });

  it("searches by name and by dungeon or raid on the server", async () => {
    const client = renderGoals();

    const panel = await openPanel();
    await within(panel).findByText(en.goals.resultCount(3));
    fireEvent.change(within(panel).getByLabelText(en.goals.searchLabel), {
      target: { value: "  blade " },
    });
    await waitFor(() =>
      expect(client.listGameItems).toHaveBeenLastCalledWith("g1", {
        q: "blade",
        activityId: undefined,
      }),
    );

    await chooseOption(
      within(panel).getByRole("combobox", { name: en.goals.activityLabel }),
      "Stockade",
    );
    await waitFor(() =>
      expect(client.listGameItems).toHaveBeenLastCalledWith("g1", {
        q: "blade",
        activityId: "a2",
      }),
    );
  });

  it("says that the name search cannot match items whose name is not available", async () => {
    renderGoals({
      listGameItems: () =>
        Promise.resolve({ items: [unavailable], nameSearchComplete: false }),
    });

    const panel = await openPanel();

    expect(
      await within(panel).findByText(en.goals.namesUnavailable),
    ).toBeTruthy();
  });

  it("closes the panel and gives focus back to its button", async () => {
    renderGoals();

    const panel = await openPanel();
    fireEvent.click(
      within(panel).getByRole("button", { name: en.goals.close }),
    );

    const toggle = screen.getByRole("button", { name: `${en.goals.add}, WoW` });
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByRole("group", { name: en.goals.panelLabel("WoW") }),
    ).toBeNull();
  });
});
