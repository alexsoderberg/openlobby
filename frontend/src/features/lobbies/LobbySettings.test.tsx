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
  type LobbyDetail,
} from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { LobbySettings } from "./LobbySettings";

const HOUR_MS = 60 * 60 * 1000;
const raid = {
  id: "m-raid",
  name: "Raid",
  maxPlayers: 8,
  gameRoles: [],
  activities: [
    { id: "a-vault", name: "Vault" },
    { id: "a-keep", name: "Keep" },
  ],
};
const duo = {
  id: "m-duo",
  name: "Duo",
  maxPlayers: 2,
  gameRoles: [],
  activities: [],
};
const game: Game = {
  id: "game1",
  name: "Destiny",
  defaultMaxPlayers: null,
  genre: null,
  modes: [raid, duo],
};
const lobby: LobbyDetail = {
  id: "l1",
  gameId: "game1",
  gameName: "Destiny",
  gameGenre: null,
  modeId: "m-raid",
  modeName: "Raid",
  activityId: null,
  maxPlayers: 8,
  startsAt: new Date(Date.now() + HOUR_MS).toISOString(),
  endsAt: new Date(Date.now() + 3 * HOUR_MS).toISOString(),
  createdByUserId: "u1",
  playerCount: 2,
  joinedByMe: true,
  players: [],
};

function renderSettings(
  shown: Partial<LobbyDetail> = {},
  overrides: Partial<ApiClient> = {},
) {
  const client = fakeApiClient({
    listGroupGames: vi.fn(() => Promise.resolve([game])),
    ...overrides,
  });
  const onChanged = vi.fn();
  render(
    <ApiProvider client={client}>
      <LobbySettings
        groupId="g1"
        lobby={{ ...lobby, ...shown }}
        onChanged={onChanged}
        onUnauthenticated={vi.fn()}
      />
    </ApiProvider>,
  );
  return { client, onChanged };
}

const modeSelect = () =>
  screen.findByRole<HTMLSelectElement>("combobox", { name: en.lobbyModeLabel });
const chooseMode = async (name: string) =>
  fireEvent.change(await modeSelect(), {
    target: { value: name === "Duo" ? "m-duo" : "m-raid" },
  });
const confirm = async () =>
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: en.lobbyModeChangeSubmit,
    }),
  );

describe("who sees the mode and activity", () => {
  it.each([
    ["is not a player", { joinedByMe: false }],
    ["has no game", { gameId: null }],
    ["has ended", { endsAt: new Date(Date.now() - HOUR_MS).toISOString() }],
  ])("shows nothing to a viewer when the lobby %s", async (_name, shown) => {
    const { client } = renderSettings(shown);

    expect(client.listGroupGames).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows nothing for a game without modes", async () => {
    const { client } = renderSettings(
      {},
      {
        listGroupGames: vi.fn(() => Promise.resolve([{ ...game, modes: [] }])),
      },
    );

    await waitFor(() => expect(client.listGroupGames).toHaveBeenCalled());
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("offers the game's modes and the activities of the current mode", async () => {
    renderSettings();

    expect(
      within(await modeSelect())
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Raid", "Duo"]);
    const activity = screen.getByRole("combobox", {
      name: en.lobbyActivityLabel,
    });
    expect(
      within(activity)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual([en.lobbyActivityNone, "Vault", "Keep"]);
  });

  it("shows the saved name of a mode that is no longer offered", async () => {
    renderSettings({ modeId: "m-gone", modeName: "Old raid" });

    const select = await modeSelect();
    expect(select.value).toBe("m-gone");
    expect(
      within(select).getByRole("option", { name: "Old raid" }),
    ).toBeTruthy();
  });

  it("explains a failed game list and shows the section after a retry", async () => {
    const listGroupGames = vi
      .fn<ApiClient["listGroupGames"]>()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValue([game]);
    renderSettings({}, { listGroupGames });

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));

    expect(await modeSelect()).toBeTruthy();
    expect(listGroupGames).toHaveBeenCalledTimes(2);
  });

  it("offers no activity for a mode without activities", async () => {
    renderSettings({ modeId: "m-duo" });

    await modeSelect();
    expect(
      screen.queryByRole("combobox", { name: en.lobbyActivityLabel }),
    ).toBeNull();
  });
});

describe("changing the mode", () => {
  it("asks first, says what changes, and sends nothing until confirmed", async () => {
    const { client } = renderSettings();

    await chooseMode("Duo");

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(en.lobbyModeChangeConfirm)).toBeTruthy();
    expect(client.setLobbyMode).not.toHaveBeenCalled();
  });

  it("sends the mode with the mode that was shown, then loads the lobby again", async () => {
    const { client, onChanged } = renderSettings();
    await chooseMode("Duo");

    await confirm();

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.setLobbyMode).toHaveBeenCalledWith(
      "g1",
      "l1",
      "m-duo",
      "m-raid",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText(en.lobbySettingsSaved)).toBeTruthy();
    expect(document.activeElement).toBe(await modeSelect());
  });

  it("sends null as the shown mode for a lobby with no mode yet", async () => {
    const { client } = renderSettings({ modeId: null });
    await chooseMode("Duo");

    await confirm();

    await waitFor(() =>
      expect(client.setLobbyMode).toHaveBeenCalledWith(
        "g1",
        "l1",
        "m-duo",
        null,
      ),
    );
  });

  it("sends nothing when the player keeps the mode", async () => {
    const { client } = renderSettings();
    await chooseMode("Duo");

    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: en.lobbyModeChangeKeep,
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(client.setLobbyMode).not.toHaveBeenCalled();
  });

  it("explains a changed lobby, loads it again and focuses the mode", async () => {
    const { onChanged } = renderSettings(
      {},
      {
        setLobbyMode: vi.fn(() =>
          Promise.reject(new ApiError(409, "lobby_changed")),
        ),
      },
    );
    await chooseMode("Duo");

    await confirm();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(en.lobbyErrors.lobby_changed);
    expect(onChanged).toHaveBeenCalled();
    expect(document.activeElement).toBe(await modeSelect());
    expect((await modeSelect()).getAttribute("aria-describedby")).toContain(
      alert.id,
    );
  });

  it("explains that the new mode has a lower limit than the players", async () => {
    const { onChanged } = renderSettings(
      {},
      {
        setLobbyMode: vi.fn(() =>
          Promise.reject(new ApiError(409, "lobby_has_more_players")),
        ),
      },
    );
    await chooseMode("Duo");

    await confirm();

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.lobbyErrors.lobby_has_more_players,
    );
    expect(onChanged).not.toHaveBeenCalled();
  });

  it.each([
    ["lobby_has_ended", en.errors.lobby_has_ended],
    ["not_allowed", en.lobbySettingsNotPlayer],
    ["invalid_mode", en.lobbyErrors.invalid_mode],
  ])("says %s in plain text and does not reload", async (code, text) => {
    const { onChanged } = renderSettings(
      {},
      {
        setLobbyMode: vi.fn(() => Promise.reject(new ApiError(403, code))),
      },
    );
    await chooseMode("Duo");

    await confirm();

    expect((await screen.findByRole("alert")).textContent).toBe(text);
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("the activity", () => {
  it("sets the chosen activity and loads the lobby again", async () => {
    const { client, onChanged } = renderSettings();

    fireEvent.change(
      await screen.findByRole("combobox", { name: en.lobbyActivityLabel }),
      { target: { value: "a-vault" } },
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.setLobbyActivity).toHaveBeenCalledWith("g1", "l1", "a-vault");
    expect(await screen.findByText(en.lobbySettingsSaved)).toBeTruthy();
  });

  it("clears the activity and keeps the mode", async () => {
    const { client, onChanged } = renderSettings({ activityId: "a-vault" });

    fireEvent.change(
      await screen.findByRole("combobox", { name: en.lobbyActivityLabel }),
      { target: { value: "" } },
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.clearLobbyActivity).toHaveBeenCalledWith("g1", "l1");
    expect(client.setLobbyMode).not.toHaveBeenCalled();
  });

  it("shows a refusal beside the activity and focuses it", async () => {
    renderSettings(
      {},
      {
        setLobbyActivity: vi.fn(() =>
          Promise.reject(new ApiError(400, "invalid_activity")),
        ),
      },
    );
    const select = await screen.findByRole("combobox", {
      name: en.lobbyActivityLabel,
    });

    fireEvent.change(select, { target: { value: "a-keep" } });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(en.lobbyErrors.invalid_activity);
    expect(select.getAttribute("aria-describedby")).toBe(alert.id);
    expect(document.activeElement).toBe(select);
  });
});
