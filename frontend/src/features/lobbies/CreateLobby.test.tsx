import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { CreateLobby } from "./CreateLobby";

// Wednesday 4 November 2026, 12:00 local time.
const NOW = new Date(2026, 10, 4, 12, 0);
const games = [
  { id: "g-chess", name: "Chess", defaultMaxPlayers: null },
  { id: "g-catan", name: "Catan", defaultMaxPlayers: 4 },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function renderForm(overrides: Partial<ApiClient> = {}) {
  const client = fakeApiClient({
    listGroupGames: vi.fn(() => Promise.resolve(games)),
    createLobby: vi.fn(() =>
      Promise.resolve({
        id: "new",
        gameName: "Catan",
        maxPlayers: 4,
        startsAt: "",
        endsAt: "",
        createdByUserId: "u1",
        playerCount: 1,
      }),
    ),
    ...overrides,
  });
  const onCreated = vi.fn();
  render(
    <ApiProvider client={client}>
      <CreateLobby
        groupId="g1"
        onCreated={onCreated}
        onUnauthenticated={vi.fn()}
      />
    </ApiProvider>,
  );
  return { client, onCreated };
}

const field = (label: string) =>
  screen.findByLabelText<HTMLInputElement & HTMLSelectElement>(label);
const set = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: en.lobbyCreateSubmit }));

/** Fills the form for tomorrow, 18:00 to 20:00, with a listed game. */
async function fillValid(times: { start?: string; end?: string } = {}) {
  set(await field(en.lobbyGameLabel), "g-catan");
  set(await field(en.lobbyDateLabel), "2026-11-05");
  set(await field(en.lobbyStartLabel), times.start ?? "18:00");
  set(await field(en.lobbyEndLabel), times.end ?? "20:00");
}

describe("game choice", () => {
  it("lists the group's games in the server's order with Other last", async () => {
    renderForm();

    const select = await field(en.lobbyGameLabel);
    expect(Array.from(select.options, (option) => option.text)).toEqual([
      en.lobbyGameChoose,
      "Chess",
      "Catan",
      "Other",
    ]);
  });

  it("fills max players from the game and replaces it when the game changes", async () => {
    renderForm();
    const select = await field(en.lobbyGameLabel);
    const max = await field(en.lobbyMaxPlayersLabel);

    set(select, "g-catan");
    expect((await field(en.lobbyMaxPlayersLabel)).value).toBe("4");
    set(await field(en.lobbyMaxPlayersLabel), "6");
    set(select, "g-chess");
    expect((await field(en.lobbyMaxPlayersLabel)).value).toBe("");
    expect(max.isConnected).toBe(false);
  });

  it("asks for a name only when Other is chosen", async () => {
    renderForm();
    expect(screen.queryByLabelText(en.lobbyCustomGameLabel)).toBeNull();

    set(await field(en.lobbyGameLabel), "other");

    expect(await field(en.lobbyCustomGameLabel)).toBeTruthy();
    expect((await field(en.lobbyMaxPlayersLabel)).value).toBe("");
  });

  it("shows the error with a retry when the games cannot be loaded", async () => {
    const listGroupGames = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValue(games);
    renderForm({ listGroupGames });

    expect((await screen.findByRole("alert")).textContent).toContain(
      en.errors.service_unavailable,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));
    expect(await field(en.lobbyGameLabel)).toBeTruthy();
  });
});

describe("saving a lobby", () => {
  it("sends the game, max players and local times, refreshes, and confirms with focus", async () => {
    const { client, onCreated } = renderForm();
    await fillValid();

    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(client.createLobby).toHaveBeenCalledWith("g1", {
      gameId: "g-catan",
      maxPlayers: 4,
      startsAt: new Date(2026, 10, 5, 18).toISOString(),
      endsAt: new Date(2026, 10, 5, 20).toISOString(),
    });
    const status = await screen.findByText(en.lobbyCreated);
    expect(document.activeElement).toBe(status);
    expect((await field(en.lobbyGameLabel)).value).toBe("");
  });

  it("sends a free-text game with the unlimited max as null", async () => {
    const { client } = renderForm();
    await fillValid();
    set(await field(en.lobbyGameLabel), "other");
    set(await field(en.lobbyCustomGameLabel), "  Dominion ");

    submit();

    await waitFor(() => expect(client.createLobby).toHaveBeenCalled());
    expect(client.createLobby).toHaveBeenCalledWith(
      "g1",
      expect.objectContaining({ customGameName: "Dominion", maxPlayers: null }),
    );
    expect(vi.mocked(client.createLobby).mock.calls[0][1]).not.toHaveProperty(
      "gameId",
    );
  });

  it("reads an end clock time before the start as the next day", async () => {
    const { client } = renderForm();
    await fillValid({ start: "22:00", end: "02:00" });

    submit();

    await waitFor(() => expect(client.createLobby).toHaveBeenCalled());
    expect(client.createLobby).toHaveBeenCalledWith(
      "g1",
      expect.objectContaining({
        startsAt: new Date(2026, 10, 5, 22).toISOString(),
        endsAt: new Date(2026, 10, 6, 2).toISOString(),
      }),
    );
  });
});

describe("local checks", () => {
  async function expectDenied(message: string, focused: string) {
    submit();
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(document.activeElement).toBe(await field(focused));
  }

  it("denies a start that has passed", async () => {
    const { client } = renderForm();
    await fillValid();
    set(await field(en.lobbyDateLabel), "2026-11-04");
    set(await field(en.lobbyStartLabel), "09:00");

    await expectDenied(en.errors.lobby_in_past, en.lobbyDateLabel);
    expect(client.createLobby).not.toHaveBeenCalled();
  });

  it("denies an end equal to the start", async () => {
    const { client } = renderForm();
    await fillValid({ start: "18:00", end: "18:00" });

    await expectDenied(en.errors.lobby_end_not_after_start, en.lobbyDateLabel);
    expect(client.createLobby).not.toHaveBeenCalled();
  });

  it("denies a missing time", async () => {
    renderForm();
    await fillValid({ end: "" });

    await expectDenied(en.lobbyTimeMissing, en.lobbyDateLabel);
  });

  it("denies no game chosen", async () => {
    const { client } = renderForm();
    await fillValid();
    set(await field(en.lobbyGameLabel), "");

    await expectDenied(en.errors.invalid_game, en.lobbyGameLabel);
    expect(client.createLobby).not.toHaveBeenCalled();
  });

  it.each(["", "x".repeat(51)])(
    "denies Other with the name %j",
    async (name) => {
      const { client } = renderForm();
      await fillValid();
      set(await field(en.lobbyGameLabel), "other");
      set(await field(en.lobbyCustomGameLabel), name);

      await expectDenied(en.errors.invalid_game, en.lobbyCustomGameLabel);
      expect(client.createLobby).not.toHaveBeenCalled();
    },
  );

  it("denies a max players that is not a whole number from 1", async () => {
    const { client } = renderForm();
    await fillValid();
    set(await field(en.lobbyMaxPlayersLabel), "0");

    await expectDenied(en.errors.invalid_capacity, en.lobbyMaxPlayersLabel);
    expect(client.createLobby).not.toHaveBeenCalled();
  });
});

describe("server errors", () => {
  it.each([
    ["lobby_too_long", en.lobbyDateLabel],
    ["lobby_in_past", en.lobbyDateLabel],
    ["lobby_end_not_after_start", en.lobbyDateLabel],
    ["invalid_game", en.lobbyGameLabel],
    ["invalid_capacity", en.lobbyMaxPlayersLabel],
    ["group_not_found", en.lobbyDateLabel],
  ] as const)("shows %s and keeps the input", async (code, focused) => {
    const { onCreated } = renderForm({
      createLobby: vi.fn(() => Promise.reject(new ApiError(400, code))),
    });
    await fillValid();

    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(en.errors[code]);
    expect(document.activeElement).toBe(await field(focused));
    expect((await field(en.lobbyStartLabel)).value).toBe("18:00");
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.queryByText(en.lobbyCreated)).toBeNull();
  });
});
