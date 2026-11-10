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
import { fakeApiClient, testUser } from "../../test/fakeApiClient";
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
      { gameRoleId: "r1", name: "Tank", slots: 1, playerCount: 1 },
      { gameRoleId: "r2", name: "Healer", slots: 1, playerCount: 0 },
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
    expect(slots.textContent).toBe("Tank 1/1, fullHealer 0/1Flex 1");
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

describe("lobby detail", () => {
  it("shows the game, spots and the names of all players in joined order", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Catan" })).toBeTruthy();
    expect(screen.getByText("2/4 players")).toBeTruthy();
    const names = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(names).toEqual(["Maja Lind", "Kim Berg"]);
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
