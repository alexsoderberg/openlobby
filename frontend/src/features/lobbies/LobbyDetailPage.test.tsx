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
  type LobbyDetail,
} from "../../api";
import { en } from "../../i18n/messages/en";
import { chooseOption } from "../../test/chooseOption";
import { fakeApiClient, testUser } from "../../test/fakeApiClient";
import { visibleText } from "../../test/visibleText";
import { LobbyDetailPage } from "./LobbyDetailPage";

const HOUR_MS = 60 * 60 * 1000;

const lobby: LobbyDetail = {
  id: "l1",
  gameName: "Catan",
  gameGenre: null,
  maxPlayers: 4,
  // Relative to now: join is only offered until the end time, so a fixed date stops working once it passes.
  startsAt: new Date(Date.now() + HOUR_MS).toISOString(),
  endsAt: new Date(Date.now() + 3 * HOUR_MS).toISOString(),
  createdByUserId: testUser.userId,
  playerCount: 2,
  joinedByMe: true,
  players: [
    { userId: testUser.userId, displayName: "Maja Lind" },
    { userId: "u2", displayName: "Kim Berg" },
  ],
};

function renderDetail(
  overrides: Partial<ApiClient> = {},
  userId = testUser.userId,
) {
  const client = fakeApiClient({
    getLobby: vi.fn(() => Promise.resolve(lobby)),
    ...overrides,
  });
  const onDeleted = vi.fn();
  render(
    <ApiProvider client={client}>
      <LobbyDetailPage
        groupId="g1"
        lobbyId="l1"
        userId={userId}
        backHref="/groups/g1"
        onDeleted={onDeleted}
        onUnauthenticated={vi.fn()}
      />
    </ApiProvider>,
  );
  return { client, onDeleted };
}

describe("lobby label, role slots and seats", () => {
  const withRoles: LobbyDetail = {
    ...lobby,
    modeName: "Competitive",
    activityName: "Control",
    flexCount: 1,
    roleSlots: [
      {
        gameRoleId: "r1",
        name: "Tank",
        slots: 1,
        playerCount: 1,
        roleIcon: "shield",
      },
      {
        gameRoleId: "r2",
        name: "Healer",
        slots: 1,
        playerCount: 0,
        roleIcon: "none",
      },
    ],
    players: [
      { userId: testUser.userId, displayName: "Maja Lind", gameRoleId: "r1" },
      { userId: "u2", displayName: "Kim Berg", gameRoleId: null },
    ],
  };

  it("shows the label, the role slots, flex and each player's seat", async () => {
    renderDetail({ getLobby: () => Promise.resolve(withRoles) });

    expect(
      await screen.findByRole("heading", {
        name: "Catan › Competitive › Control",
      }),
    ).toBeTruthy();
    const slots = screen.getByRole("list", { name: en.lobbyRoleSlotsLabel });
    expect(visibleText(slots)).toBe("Tank 1/1Healer 0/1Flex 1");
    // The class carries the filled accent look, which jsdom cannot see.
    expect(
      within(slots).getByText(en.lobbyRoleSlotFullSuffix).closest("li")
        ?.className,
    ).toContain("badge--full");
  });

  it("lists the players under their game role, flex last", async () => {
    renderDetail({ getLobby: () => Promise.resolve(withRoles) });

    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["Tank", "Flex"]);
    expect(
      within(screen.getByRole("region", { name: "Tank" })).getByText(
        "Maja Lind",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Flex" })).getByText(
        "Kim Berg",
      ),
    ).toBeTruthy();
  });

  it("puts the role icon before the role slot and its player group heading, never on Flex or a role without one", async () => {
    renderDetail({ getLobby: () => Promise.resolve(withRoles) });

    await screen.findByRole("heading", { level: 1 });
    const [tank, healer, flex] = within(
      screen.getByRole("list", { name: en.lobbyRoleSlotsLabel }),
    ).getAllByRole("listitem");
    expect(tank.querySelector('[data-icon="shield"]')).not.toBeNull();
    expect(healer.querySelector("svg")).toBeNull();
    expect(flex.querySelector("svg")).toBeNull();
    const [tankHeading, flexHeading] = screen.getAllByRole("heading", {
      level: 3,
    });
    expect(tankHeading.querySelector('[data-icon="shield"]')).not.toBeNull();
    expect(tankHeading.textContent).toBe("Tank");
    expect(flexHeading.querySelector("svg")).toBeNull();
  });

  it("shows each player's preferred game roles next to the name", async () => {
    renderDetail({
      getLobby: () =>
        Promise.resolve({
          ...withRoles,
          players: [
            {
              ...withRoles.players[0],
              preferredGameRoles: [
                {
                  gameRoleId: "r1",
                  name: "Tank",
                  gameName: "Catan",
                  modeName: "Competitive",
                },
                {
                  gameRoleId: "r3",
                  name: "Support",
                  gameName: "Catan",
                  modeName: null,
                },
              ],
            },
            { ...withRoles.players[1], preferredGameRoles: [] },
          ],
        }),
    });

    const tank = await screen.findByRole("region", { name: "Tank" });
    const maja = within(tank).getByRole("listitem");
    expect(within(maja).getByText("Maja Lind")).toBeTruthy();
    expect(
      within(maja).getByText(
        en.preferredGameRoles.plays([
          { roles: ["Tank (Competitive)", "Support"] },
        ]),
      ),
    ).toBeTruthy();
    const flex = screen.getByRole("region", { name: "Flex" });
    const kim = within(flex).getByRole("listitem");
    expect(within(kim).getByText("Kim Berg")).toBeTruthy();
    expect(within(kim).queryByText(/Plays/)).toBeNull();
  });

  it("still lists a player whose game role is unknown or missing", async () => {
    renderDetail({
      getLobby: () =>
        Promise.resolve({
          ...withRoles,
          players: [
            ...withRoles.players,
            { userId: "u3", displayName: "Alva Ek", gameRoleId: "gone" },
            { userId: "u4", displayName: "Noa Sund" },
          ],
        }),
    });

    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByText("Alva Ek")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Flex" })).getByText(
        "Noa Sund",
      ),
    ).toBeTruthy();
  });

  it("names a lobby with a mode and an activity in the delete heading", async () => {
    renderDetail({ getLobby: () => Promise.resolve(withRoles) });

    fireEvent.click(
      await screen.findByRole("button", { name: en.lobbyDelete }),
    );

    expect(
      await screen.findByRole("heading", {
        name: en.lobbyDeleteHeading("Catan › Competitive › Control"),
      }),
    ).toBeTruthy();
  });

  it("looks as before for a lobby without role slots", async () => {
    renderDetail();

    await screen.findByRole("heading", { name: "Catan" });
    expect(
      screen.queryByRole("list", { name: en.lobbyRoleSlotsLabel }),
    ).toBeNull();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });
});

describe("changing the mode on the page", () => {
  it("confirms a mode change, loads the lobby again and shows the new label", async () => {
    const mode = (id: string, name: string) => ({
      id,
      name,
      maxPlayers: 4,
      gameRoles: [],
      activities: [],
    });
    const withMode = (id: string, name: string): LobbyDetail => ({
      ...lobby,
      gameId: "game1",
      modeId: id,
      modeName: name,
    });
    const getLobby = vi
      .fn<ApiClient["getLobby"]>()
      .mockResolvedValueOnce(withMode("m1", "Casual"))
      .mockResolvedValue(withMode("m2", "Ranked"));
    const { client } = renderDetail({
      getLobby,
      listGroupGames: vi.fn(() =>
        Promise.resolve([
          {
            id: "game1",
            name: "Catan",
            defaultMaxPlayers: null,
            genre: null,
            modes: [mode("m1", "Casual"), mode("m2", "Ranked")],
          },
        ]),
      ),
    });

    await chooseOption(
      await screen.findByRole("combobox", { name: en.lobbyModeLabel }),
      "Ranked",
    );
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: en.lobbyModeChangeSubmit,
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: `Catan${en.lobbyLabelSeparator}Ranked`,
      }),
    ).toBeTruthy();
    expect(client.setLobbyMode).toHaveBeenCalledWith("g1", "l1", "m2", "m1");
    expect(getLobby).toHaveBeenCalledTimes(2);
  });
});

describe("page order", () => {
  it("puts the settings between the players and the actions, in one panel, as the side column (REQ-0025)", async () => {
    const mode = {
      id: "m1",
      name: "Casual",
      maxPlayers: 4,
      gameRoles: [],
      activities: [],
    };
    renderDetail({
      getLobby: () =>
        Promise.resolve({
          ...lobby,
          gameId: "game1",
          modeId: "m1",
          modeName: "Casual",
        }),
      listGroupGames: vi.fn(() =>
        Promise.resolve([
          {
            id: "game1",
            name: "Catan",
            defaultMaxPlayers: null,
            genre: null,
            modes: [mode],
          },
        ]),
      ),
    });

    const settings = await screen.findByRole("combobox", {
      name: en.lobbyModeLabel,
    });
    const players = screen.getByRole("heading", {
      name: en.lobbyPlayersHeading,
    });
    const leave = screen.getByRole("button", { name: en.lobbyLeave });
    expect(players.compareDocumentPosition(settings)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(settings.compareDocumentPosition(leave)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const side = settings.closest(".side-column");
    expect(side).not.toBeNull();
    expect(side!.parentElement).toBe(leave.closest(".panel"));
  });
});

describe("an open lobby on the page", () => {
  it("is labelled Open, and a player sets the game, then the page shows it and offers its modes", async () => {
    const open: LobbyDetail = { ...lobby, gameId: null, gameName: null };
    const getLobby = vi
      .fn<ApiClient["getLobby"]>()
      .mockResolvedValueOnce(open)
      .mockResolvedValue({ ...lobby, gameId: "game1" });
    const { client } = renderDetail({
      getLobby,
      listGroupGames: vi.fn(() =>
        Promise.resolve([
          {
            id: "game1",
            name: "Catan",
            defaultMaxPlayers: null,
            genre: null,
            modes: [
              {
                id: "m1",
                name: "Casual",
                maxPlayers: 4,
                gameRoles: [],
                activities: [],
              },
            ],
          },
        ]),
      ),
    });

    expect(
      await screen.findByRole("heading", { name: en.lobbyOpen }),
    ).toBeTruthy();
    await chooseOption(
      await screen.findByRole("combobox", { name: en.lobbyGameLabel }),
      "Catan",
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.lobbyGameSetSubmit }),
    );

    expect(await screen.findByRole("heading", { name: "Catan" })).toBeTruthy();
    expect(client.setLobbyGame).toHaveBeenCalledWith("g1", "l1", "game1");
    expect(
      await screen.findByRole("combobox", { name: en.lobbyModeLabel }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByText(en.lobbyGameSaved));
  });
});

describe("lobby theme", () => {
  it("shows the genre name beside the game name", async () => {
    renderDetail({
      getLobby: () => Promise.resolve({ ...lobby, gameGenre: "survival" }),
    });

    expect(await screen.findByText(en.genre.survival)).toBeTruthy();
    expect(
      screen
        .getByRole("heading", { name: "Catan" })
        .closest("header")
        ?.getAttribute("data-genre"),
    ).toBe("survival");
  });

  it("shows no genre name for a neutral lobby", async () => {
    renderDetail();

    await screen.findByRole("heading", { name: "Catan" });
    for (const name of Object.values(en.genre))
      if (name !== en.genre.none) expect(screen.queryByText(name)).toBeNull();
  });
});

describe("game logo", () => {
  const VERSION = "d".repeat(64);

  it("shows the logo before the game name in the lobby header", async () => {
    renderDetail({
      getLobby: () =>
        Promise.resolve({
          ...lobby,
          gameId: "game1",
          gameLogoVersion: VERSION,
        }),
    });

    const header = (
      await screen.findByRole("heading", { name: "Catan" })
    ).closest("header")!;
    const logo = header.querySelector('[data-slot="game-logo"] img');
    expect(logo?.getAttribute("src")).toBe(
      `/api/games/game1/images/logo?v=${VERSION}`,
    );
    expect(logo?.getAttribute("alt")).toBe("");
  });

  it("shows the monogram after the logo fails to load", async () => {
    renderDetail({
      getLobby: () =>
        Promise.resolve({
          ...lobby,
          gameId: "game1",
          gameLogoVersion: VERSION,
        }),
    });

    const header = (
      await screen.findByRole("heading", { name: "Catan" })
    ).closest("header")!;
    fireEvent.error(header.querySelector('[data-slot="game-logo"] img')!);
    expect(within(header).getByText("C")).toBeTruthy();
    expect(header.querySelector('[data-slot="game-logo"] img')).toBeNull();
  });
});

describe("game cover", () => {
  const VERSION = "c".repeat(64);
  const withCover = { ...lobby, gameId: "game1", gameCoverVersion: VERSION };
  const header = async () =>
    (await screen.findByRole("heading", { name: "Catan" })).closest("header")!;
  const coverOf = (element: HTMLElement) =>
    element.querySelector(".genre-frame__cover");

  it("fills the lobby header behind its content", async () => {
    renderDetail({ getLobby: () => Promise.resolve(withCover) });

    const head = await header();
    expect(coverOf(head)?.getAttribute("src")).toBe(
      `/api/games/game1/images/cover?v=${VERSION}`,
    );
    expect(coverOf(head)?.getAttribute("alt")).toBe("");
    expect(document.querySelectorAll(".genre-frame__cover")).toHaveLength(1);
  });

  it("shows the genre theme for a game without a cover", async () => {
    renderDetail({
      getLobby: () =>
        Promise.resolve({ ...lobby, gameId: "game1", gameGenre: "survival" }),
    });

    const head = await header();
    expect(coverOf(head)).toBeNull();
    expect(head.dataset.genre).toBe("survival");
  });

  it("shows the genre theme after the cover fails to load", async () => {
    renderDetail({ getLobby: () => Promise.resolve(withCover) });

    const head = await header();
    fireEvent.error(coverOf(head)!);
    expect(coverOf(head)).toBeNull();
    expect(head.hasAttribute("data-cover")).toBe(false);
  });
});

describe("lobby detail", () => {
  it("shows the game, spots and the names of all players in joined order", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Catan" })).toBeTruthy();
    expect(screen.getByText("2/4 players")).toBeTruthy();
    const players = screen.getAllByRole("listitem");
    expect(players).toHaveLength(2);
    const [first, second] = players;
    expect(within(first).getByText("Maja Lind")).toBeTruthy();
    expect(within(second).getByText("Kim Berg")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: en.lobbyBackToGroup })
        .getAttribute("href"),
    ).toBe("/groups/g1");
  });

  it("says so when nobody is a player", async () => {
    renderDetail({
      getLobby: vi.fn(() =>
        Promise.resolve({ ...lobby, players: [], playerCount: 0 }),
      ),
    });

    expect(await screen.findByText(en.lobbyNoPlayers)).toBeTruthy();
  });

  it.each(["lobby_not_found", "group_not_found"])(
    "shows not found for %s without lobby data",
    async (code) => {
      renderDetail({
        getLobby: vi.fn(() => Promise.reject(new ApiError(404, code))),
      });

      expect(
        await screen.findByRole("heading", { name: en.lobbyNotFoundHeading }),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: en.lobbyDelete })).toBeNull();
    },
  );

  it("shows another failure with a retry", async () => {
    const getLobby = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValue(lobby);
    renderDetail({ getLobby });

    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));
    expect(await screen.findByRole("heading", { name: "Catan" })).toBeTruthy();
  });
});

describe("deleting a lobby", () => {
  async function openDialog() {
    fireEvent.click(
      await screen.findByRole("button", { name: en.lobbyDelete }),
    );
    return screen.findByRole("dialog", {
      name: en.lobbyDeleteHeading("Catan"),
    });
  }

  it("is offered to the creator only", async () => {
    renderDetail({}, "u2");

    await screen.findByRole("heading", { name: "Catan" });
    expect(screen.queryByRole("button", { name: en.lobbyDelete })).toBeNull();
  });

  it("asks first, with Keep focused, and deletes only on confirmation", async () => {
    const { client, onDeleted } = renderDetail();
    const dialog = await openDialog();

    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: en.lobbyDeleteKeep }),
    );
    expect(client.deleteLobby).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: en.lobbyDeleteSubmit }),
    );

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(client.deleteLobby).toHaveBeenCalledWith("g1", "l1");
  });

  it("keeps the lobby when the dialog is cancelled", async () => {
    const { client, onDeleted } = renderDetail();
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", { name: en.lobbyDeleteKeep }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(client.deleteLobby).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("shows a refusal in the dialog and stays", async () => {
    const { onDeleted } = renderDetail({
      deleteLobby: vi.fn(() =>
        Promise.reject(new ApiError(403, "not_allowed")),
      ),
    });
    const dialog = await openDialog();

    fireEvent.click(
      within(dialog).getByRole("button", { name: en.lobbyDeleteSubmit }),
    );

    expect((await within(dialog).findByRole("alert")).textContent).toBe(
      en.errors.not_allowed,
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

describe("joining and leaving on the page", () => {
  it("shows Ended and does not reload when joining answers that the lobby has ended", async () => {
    const getLobby = vi.fn(() =>
      Promise.resolve({ ...lobby, joinedByMe: false }),
    );
    renderDetail({
      getLobby,
      joinLobby: vi.fn(() =>
        Promise.reject(new ApiError(409, "lobby_has_ended")),
      ),
    });

    fireEvent.click(await screen.findByRole("button", { name: en.lobbyJoin }));

    expect(await screen.findByText(en.lobbyEnded)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getLobby).toHaveBeenCalledOnce();
  });

  it("offers leave to a player and loads the lobby again after leaving", async () => {
    const after = {
      ...lobby,
      joinedByMe: false,
      playerCount: 1,
      players: [lobby.players[1]],
    };
    const getLobby = vi
      .fn()
      .mockResolvedValueOnce(lobby)
      .mockResolvedValue(after);
    const { client } = renderDetail({ getLobby });

    fireEvent.click(await screen.findByRole("button", { name: en.lobbyLeave }));

    expect(await screen.findByText("1/4 players")).toBeTruthy();
    expect(client.leaveLobby).toHaveBeenCalledWith("g1", "l1");
    expect(screen.queryByText("Maja Lind")).toBeNull();
    expect(screen.getByRole("button", { name: en.lobbyJoin })).toBeTruthy();
  });

  it("shows not found when the lobby was deleted while leaving", async () => {
    const getLobby = vi
      .fn()
      .mockResolvedValueOnce(lobby)
      .mockRejectedValue(new ApiError(404, "lobby_not_found"));
    renderDetail({
      getLobby,
      leaveLobby: vi.fn(() =>
        Promise.reject(new ApiError(404, "lobby_not_found")),
      ),
    });

    fireEvent.click(await screen.findByRole("button", { name: en.lobbyLeave }));

    expect(
      await screen.findByRole("heading", { name: en.lobbyNotFoundHeading }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
