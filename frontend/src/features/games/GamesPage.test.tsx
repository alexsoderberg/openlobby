import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient, type Game } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { GamesPage } from "./GamesPage";

const catan: Game = { id: "g1", name: "Catan", defaultMaxPlayers: 4 };
const chess: Game = { id: "g2", name: "Chess", defaultMaxPlayers: null };

function renderPage(client: ApiClient, isSystemAdmin = true) {
  const onUnauthenticated = vi.fn();
  render(
    <ApiProvider client={client}>
      <GamesPage
        isSystemAdmin={isSystemAdmin}
        onUnauthenticated={onUnauthenticated}
      />
    </ApiProvider>,
  );
  return { onUnauthenticated };
}

function adminClient(overrides: Partial<ApiClient> = {}) {
  return fakeApiClient({
    listGames: vi.fn(() => Promise.resolve([catan, chess])),
    ...overrides,
  });
}

function fill(scope: HTMLElement, name: string, max = "") {
  fireEvent.change(within(scope).getByLabelText(en.gameNameLabel), {
    target: { value: name },
  });
  fireEvent.change(within(scope).getByLabelText(en.gameMaxPlayersLabel), {
    target: { value: max },
  });
}

function valueOf(scope: HTMLElement, label: string) {
  return (within(scope).getByLabelText(label) as HTMLInputElement).value;
}

async function addForm() {
  await screen.findByText("Catan");
  return screen
    .getByRole("heading", { name: en.gameAddHeading })
    .closest("section")!;
}

describe("game list", () => {
  it("lists each game with its default max, empty meaning no limit", async () => {
    renderPage(adminClient());

    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      `Catan${en.gameMaxPlayers(4)}${en.gameEdit}${en.gameRemove}`,
      `Chess${en.gameUnlimited}${en.gameEdit}${en.gameRemove}`,
    ]);
  });

  it("shows the empty state", async () => {
    renderPage(fakeApiClient());
    expect(await screen.findByText(en.gameListEmpty)).toBeTruthy();
  });

  it("shows a load error with a retry", async () => {
    const listGames = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(500, "internal_error"))
      .mockResolvedValue([catan]);
    renderPage(fakeApiClient({ listGames }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.internal_error,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));
    expect(await screen.findByText("Catan")).toBeTruthy();
  });

  it("denies a non-admin without loading the list", () => {
    const client = adminClient();
    renderPage(client, false);

    expect(screen.getByText(en.gameListDenied)).toBeTruthy();
    expect(client.listGames).not.toHaveBeenCalled();
    expect(screen.queryByText("Catan")).toBeNull();
  });

  it("denies when the server answers not_allowed", async () => {
    renderPage(
      fakeApiClient({
        listGames: () => Promise.reject(new ApiError(403, "not_allowed")),
      }),
    );
    expect(await screen.findByText(en.gameListDenied)).toBeTruthy();
  });

  it("hands an expired session over", async () => {
    const { onUnauthenticated } = renderPage(
      fakeApiClient({
        listGames: () => Promise.reject(new ApiError(401, "unauthenticated")),
      }),
    );
    await waitFor(() => expect(onUnauthenticated).toHaveBeenCalledOnce());
  });
});

describe("add", () => {
  it("sends name and max, refreshes the list, resets the form and focuses the status", async () => {
    const client = adminClient();
    renderPage(client);
    const form = await addForm();

    fill(form, "  Azul ", "2");
    fireEvent.click(screen.getByRole("button", { name: en.gameAddSubmit }));

    await waitFor(() =>
      expect(client.createGame).toHaveBeenCalledWith({
        name: "Azul",
        defaultMaxPlayers: 2,
      }),
    );
    const status = await screen.findByText(en.gameAdded);
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(client.listGames).toHaveBeenCalledTimes(2);
    expect(valueOf(form, en.gameNameLabel)).toBe("");
  });

  it("sends no limit for an empty max", async () => {
    const client = adminClient();
    renderPage(client);
    fill(await addForm(), "Azul");
    fireEvent.click(screen.getByRole("button", { name: en.gameAddSubmit }));

    await waitFor(() =>
      expect(client.createGame).toHaveBeenCalledWith({
        name: "Azul",
        defaultMaxPlayers: null,
      }),
    );
  });

  it.each([
    ["", "", "invalid_game", en.gameNameLabel],
    ["x".repeat(51), "", "invalid_game", en.gameNameLabel],
    [" other ", "", "invalid_game", en.gameNameLabel],
    ["Azul", "0", "invalid_capacity", en.gameMaxPlayersLabel],
    ["Azul", "2.5", "invalid_capacity", en.gameMaxPlayersLabel],
    ["Azul", "abc", "invalid_capacity", en.gameMaxPlayersLabel],
  ] as const)(
    "validates %j / %j locally without calling the server",
    async (name, max, code, focusedLabel) => {
      const client = adminClient();
      renderPage(client);
      const form = await addForm();

      fill(form, name, max);
      fireEvent.click(screen.getByRole("button", { name: en.gameAddSubmit }));

      const error = await within(form).findByRole("alert");
      expect(error.textContent).toBe(en.errors[code]);
      const field = within(form).getByLabelText(focusedLabel);
      expect(document.activeElement).toBe(field);
      expect(field.getAttribute("aria-describedby")).toContain(error.id);
      expect(client.createGame).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["invalid_game", en.gameNameLabel],
    ["invalid_capacity", en.gameMaxPlayersLabel],
    ["game_taken", en.gameNameLabel],
    ["game_not_found", en.gameNameLabel],
    ["not_allowed", en.gameNameLabel],
  ] as const)(
    "shows the server error %s next to its field",
    async (code, label) => {
      const client = adminClient({
        createGame: () => Promise.reject(new ApiError(400, code)),
      });
      renderPage(client);
      const form = await addForm();

      fill(form, "Azul", "2");
      fireEvent.click(screen.getByRole("button", { name: en.gameAddSubmit }));

      expect((await within(form).findByRole("alert")).textContent).toBe(
        en.errors[code],
      );
      expect(document.activeElement).toBe(within(form).getByLabelText(label));
      expect(valueOf(form, en.gameNameLabel)).toBe("Azul");
    },
  );
});

describe("change", () => {
  async function startEdit() {
    await screen.findByText("Catan");
    fireEvent.click(
      screen.getByRole("button", { name: `${en.gameEdit}, Catan` }),
    );
    return screen
      .getByRole("button", { name: en.gameEditSubmit })
      .closest("form")!;
  }

  it("saves the whole game, closes the form and focuses the status", async () => {
    const client = adminClient();
    renderPage(client);
    const form = await startEdit();

    expect(valueOf(form, en.gameNameLabel)).toBe("Catan");
    expect(valueOf(form, en.gameMaxPlayersLabel)).toBe("4");
    fill(form, "Catan 5th", "");
    fireEvent.click(
      within(form).getByRole("button", { name: en.gameEditSubmit }),
    );

    await waitFor(() =>
      expect(client.replaceGame).toHaveBeenCalledWith("g1", {
        name: "Catan 5th",
        defaultMaxPlayers: null,
      }),
    );
    const status = await screen.findByText(en.gameChanged);
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(
      screen.queryByRole("button", { name: en.gameEditSubmit }),
    ).toBeNull();
  });

  it("cancels without saving", async () => {
    const client = adminClient();
    renderPage(client);
    const form = await startEdit();

    fireEvent.click(
      within(form).getByRole("button", { name: en.gameEditCancel }),
    );

    expect(
      screen.queryByRole("button", { name: en.gameEditSubmit }),
    ).toBeNull();
    expect(client.replaceGame).not.toHaveBeenCalled();
  });

  it("shows game_taken in the open form", async () => {
    renderPage(
      adminClient({
        replaceGame: () => Promise.reject(new ApiError(409, "game_taken")),
      }),
    );
    const form = await startEdit();
    fireEvent.click(
      within(form).getByRole("button", { name: en.gameEditSubmit }),
    );

    expect((await within(form).findByRole("alert")).textContent).toBe(
      en.errors.game_taken,
    );
  });

  it("refreshes the list when the game is gone", async () => {
    const client = adminClient({
      replaceGame: () => Promise.reject(new ApiError(404, "game_not_found")),
    });
    renderPage(client);
    const form = await startEdit();
    fireEvent.click(
      within(form).getByRole("button", { name: en.gameEditSubmit }),
    );

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.game_not_found,
    );
    await waitFor(() => expect(client.listGames).toHaveBeenCalledTimes(2));
  });
});

describe("remove", () => {
  async function openDialog() {
    await screen.findByText("Catan");
    fireEvent.click(
      screen.getByRole("button", { name: `${en.gameRemove}, Catan` }),
    );
    return screen.findByRole("dialog", {
      name: en.gameRemoveHeading("Catan"),
    });
  }

  it("asks first and removes only after confirmation", async () => {
    const client = adminClient();
    renderPage(client);
    const dialog = await openDialog();

    expect(client.deleteGame).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: en.gameRemoveKeep }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: en.gameRemoveSubmit }),
    );

    await waitFor(() => expect(client.deleteGame).toHaveBeenCalledWith("g1"));
    const status = await screen.findByText(en.gameRemoved);
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the game when the dialog is cancelled", async () => {
    const client = adminClient();
    renderPage(client);
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", { name: en.gameRemoveKeep }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(client.deleteGame).not.toHaveBeenCalled();
    expect(screen.getByText("Catan")).toBeTruthy();
  });

  it.each(["game_not_found", "not_allowed", "internal_error"] as const)(
    "shows %s in the dialog and keeps it open",
    async (code) => {
      renderPage(
        adminClient({
          deleteGame: () => Promise.reject(new ApiError(404, code)),
        }),
      );
      const dialog = await openDialog();
      fireEvent.click(
        within(dialog).getByRole("button", { name: en.gameRemoveSubmit }),
      );

      expect((await within(dialog).findByRole("alert")).textContent).toBe(
        en.errors[code],
      );
      expect(screen.getByRole("dialog")).toBeTruthy();
    },
  );
});
