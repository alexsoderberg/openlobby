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

const lobby: LobbyDetail = {
  id: "l1",
  gameName: "Catan",
  maxPlayers: 4,
  startsAt: new Date(2026, 10, 5, 18).toISOString(),
  endsAt: new Date(2026, 10, 5, 20).toISOString(),
  createdByUserId: testUser.userId,
  playerCount: 2,
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
