import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ApiProvider,
  type ApiClient,
  type Game,
  type LobbyDetail,
} from "../../api";
import { en } from "../../i18n/messages/en";
import { chooseOption, optionNames } from "../../test/chooseOption";
import { fakeApiClient } from "../../test/fakeApiClient";
import { expectNoToast, findToast } from "../../test/toasts";
import { Toaster } from "../../ui";
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
  const headingRef = createRef<HTMLHeadingElement>();
  // The page heading, which takes focus when a set game leaves no settings to show.
  const page = (shown: Partial<LobbyDetail>) => (
    <ApiProvider client={client}>
      <h1 ref={headingRef} tabIndex={-1}>
        Lobby
      </h1>
      <div>
        <LobbySettings
          groupId="g1"
          lobby={{ ...lobby, ...shown }}
          headingRef={headingRef}
          onChanged={onChanged}
          onUnauthenticated={vi.fn()}
        />
      </div>
      <Toaster />
    </ApiProvider>
  );
  const view = render(page(shown));
  const heading = headingRef.current!;
  const container = heading.nextElementSibling!;
  /** Shows the lobby as the page has it once it has loaded again. */
  const reloadAs = (next: Partial<LobbyDetail>) => view.rerender(page(next));
  return { client, onChanged, container, heading, reloadAs };
}

const modeSelect = () =>
  screen.findByRole("combobox", { name: en.lobbyModeLabel });
const chooseMode = async (name: string) =>
  chooseOption(await modeSelect(), name);
const confirm = async () =>
  fireEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: en.lobbyModeChangeSubmit,
    }),
  );

describe("who sees the mode and activity", () => {
  it.each([
    ["is not a player", { joinedByMe: false }],
    ["has a custom game name", { gameId: null }],
    ["has ended", { endsAt: new Date(Date.now() - HOUR_MS).toISOString() }],
  ])("shows nothing to a viewer when the lobby %s", async (_name, shown) => {
    const { client, container } = renderSettings(shown);

    expect(client.listGroupGames).not.toHaveBeenCalled();
    expect(container.childElementCount).toBe(0);
  });

  // An empty render leaves the lobby page without a side column (REQ-0025).
  it("shows nothing for a game without modes", async () => {
    const { client, container } = renderSettings(
      {},
      {
        listGroupGames: vi.fn(() => Promise.resolve([{ ...game, modes: [] }])),
      },
    );

    await waitFor(() => expect(client.listGroupGames).toHaveBeenCalled());
    expect(container.childElementCount).toBe(0);
  });

  it("offers the game's modes and the activities of the current mode", async () => {
    renderSettings();

    expect(await optionNames(await modeSelect())).toEqual(["Raid", "Duo"]);
    const activity = screen.getByRole("combobox", {
      name: en.lobbyActivityLabel,
    });
    expect(await optionNames(activity)).toEqual([
      en.lobbyActivityNone,
      "Vault",
      "Keep",
    ]);
  });

  it("shows the saved name of a mode that is no longer offered", async () => {
    renderSettings({ modeId: "m-gone", modeName: "Old raid" });

    const select = await modeSelect();
    expect(select.textContent).toBe("Old raid");
    fireEvent.keyDown(select, { key: "Enter" });
    expect(
      screen
        .getByRole("option", { name: "Old raid" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
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

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(en.lobbyModeChangeConfirm)).toBeTruthy();
    expect(client.setLobbyMode).not.toHaveBeenCalled();
    // The list gives focus back to its field as it closes; Keep must keep it.
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: en.lobbyModeChangeKeep }),
    );
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
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await findToast(en.lobbySettingsSaved);
    const mode = await modeSelect();
    await waitFor(() => expect(document.activeElement).toBe(mode));
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
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: en.lobbyModeChangeKeep,
      }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(client.setLobbyMode).not.toHaveBeenCalled();
  });

  /** The refusal, read inside the open dialog. */
  const dialogAlert = async () =>
    within(await screen.findByRole("alertdialog")).findByRole("alert");
  const keep = () =>
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: en.lobbyModeChangeKeep,
      }),
    );

  it("explains a changed lobby in the dialog, loads it again and focuses the mode after Keep", async () => {
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

    expect((await dialogAlert()).textContent).toBe(
      en.lobbyErrors.lobby_changed,
    );
    expect(onChanged).toHaveBeenCalled();
    keep();
    const mode = await modeSelect();
    await waitFor(() => expect(document.activeElement).toBe(mode));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps a refused mode change in the dialog and changes nothing", async () => {
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

    expect((await dialogAlert()).textContent).toBe(
      en.lobbyErrors.lobby_has_more_players,
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
    keep();
    const mode = await modeSelect();
    await waitFor(() => expect(document.activeElement).toBe(mode));
    // Closed as not confirmed: no saved status, and the field still shows the old mode.
    expect(screen.queryByText(en.lobbySettingsSaved)).toBeNull();
    expect(mode.textContent).toContain("Raid");
  });

  it.each([
    ["lobby_has_ended", en.errors.lobby_has_ended],
    ["not_allowed", en.lobbySettingsNotPlayer],
    ["invalid_mode", en.lobbyErrors.invalid_mode],
  ])(
    "says %s in plain text in the dialog and does not reload",
    async (code, text) => {
      const { onChanged } = renderSettings(
        {},
        {
          setLobbyMode: vi.fn(() => Promise.reject(new ApiError(403, code))),
        },
      );
      await chooseMode("Duo");

      await confirm();

      expect((await dialogAlert()).textContent).toBe(text);
      expect(onChanged).not.toHaveBeenCalled();
      await expectNoToast();
    },
  );
});

describe("the activity", () => {
  it("sets the chosen activity and loads the lobby again", async () => {
    const { client, onChanged } = renderSettings();

    await chooseOption(
      await screen.findByRole("combobox", { name: en.lobbyActivityLabel }),
      "Vault",
    );

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.setLobbyActivity).toHaveBeenCalledWith("g1", "l1", "a-vault");
    await findToast(en.lobbySettingsSaved);
  });

  it("clears the activity and keeps the mode", async () => {
    const { client, onChanged } = renderSettings({ activityId: "a-vault" });

    await chooseOption(
      await screen.findByRole("combobox", { name: en.lobbyActivityLabel }),
      en.lobbyActivityNone,
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

    await chooseOption(select, "Keep");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(en.lobbyErrors.invalid_activity);
    expect(select.getAttribute("aria-describedby")).toBe(alert.id);
    await waitFor(() => expect(document.activeElement).toBe(select));
  });
});

describe("setting the game of an open lobby", () => {
  const open = { gameId: null, gameName: null, modeId: null, modeName: null };
  const gameSelect = () =>
    screen.findByRole("combobox", { name: en.lobbyGameLabel });
  const setGame = async () => {
    await chooseOption(await gameSelect(), "Destiny");
    fireEvent.click(
      screen.getByRole("button", { name: en.lobbyGameSetSubmit }),
    );
  };

  it("shows nothing to a viewer who is not a player", () => {
    const { client } = renderSettings({ ...open, joinedByMe: false });

    expect(client.listGroupGames).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("offers the group's games and sends nothing until a game is chosen", async () => {
    const { client } = renderSettings(open);

    const select = await gameSelect();
    expect(select.textContent).toBe(en.lobbyGameSetChoose);
    expect(await optionNames(select)).toEqual(["Destiny"]);
    expect(
      (
        screen.getByRole("button", {
          name: en.lobbyGameSetSubmit,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(client.setLobbyGame).not.toHaveBeenCalled();
  });

  it("sets the chosen game, confirms with a toast, and focuses the mode once the lobby has loaded again", async () => {
    const { client, onChanged, reloadAs } = renderSettings(open);

    await setGame();

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.setLobbyGame).toHaveBeenCalledWith("g1", "l1", "game1");
    await findToast(en.lobbyGameSaved);
    reloadAs({ modeId: null, modeName: null });
    const mode = await modeSelect();
    await waitFor(() => expect(document.activeElement).toBe(mode));
  });

  // No settings are left to show, so focus goes to the page heading, which now names the game.
  it("focuses the page heading after setting a game without modes", async () => {
    const { heading, reloadAs } = renderSettings(open, {
      listGroupGames: vi.fn(() => Promise.resolve([{ ...game, modes: [] }])),
    });

    await setGame();
    await findToast(en.lobbyGameSaved);
    reloadAs({});

    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("explains that someone set the game first, loads the lobby again and focuses the message", async () => {
    const { onChanged } = renderSettings(open, {
      setLobbyGame: vi.fn(() =>
        Promise.reject(new ApiError(409, "lobby_game_set")),
      ),
    });

    await setGame();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(en.lobbyErrors.lobby_game_set);
    expect(onChanged).toHaveBeenCalled();
    // Focus moves in an effect after the message renders, which findByRole can resolve before.
    await waitFor(() => expect(document.activeElement).toBe(alert));
  });

  it("explains a game that is no longer listed beside the game and does not reload", async () => {
    const { onChanged } = renderSettings(open, {
      setLobbyGame: vi.fn(() =>
        Promise.reject(new ApiError(400, "invalid_game")),
      ),
    });

    await setGame();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(en.lobbyGameSetInvalid);
    expect(onChanged).not.toHaveBeenCalled();
    const select = await gameSelect();
    expect(select.getAttribute("aria-describedby")).toContain(alert.id);
    await waitFor(() => expect(document.activeElement).toBe(select));
    await expectNoToast();
  });
});
