import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient, testUser } from "../../test/fakeApiClient";
import { LobbyDetailPage } from "./LobbyDetailPage";
import { LobbyMembership } from "./LobbyMembership";

const roleSlots = [
  { gameRoleId: "r-tank", name: "Tank", slots: 1, playerCount: 1 },
  { gameRoleId: "r-heal", name: "Healer", slots: 2, playerCount: 0 },
];
const lobby = {
  id: "l1",
  joinedByMe: false,
  endsAt: new Date(Date.now() + 3_600_000).toISOString(),
  roleSlots,
};

function renderMembership(
  props: { joinedByMe?: boolean; seat?: string | null } = {},
  overrides: Partial<ApiClient> = {},
) {
  const client = fakeApiClient(overrides);
  const onChanged = vi.fn();
  render(
    <ApiProvider client={client}>
      <LobbyMembership
        groupId="g1"
        lobby={{ ...lobby, joinedByMe: props.joinedByMe ?? false }}
        seat={props.seat}
        onChanged={onChanged}
        onUnauthenticated={vi.fn()}
      />
    </ApiProvider>,
  );
  return { client, onChanged };
}

const radio = (name: string) =>
  screen.getByRole<HTMLInputElement>("radio", { name });
const open = async (name: string) =>
  fireEvent.click(await screen.findByRole("button", { name }));
const submit = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("joining a lobby with game roles", () => {
  it("asks for a seat before it joins", async () => {
    const { client } = renderMembership();

    await open(en.lobbyJoin);

    expect(client.joinLobby).not.toHaveBeenCalled();
    expect(
      screen.getByRole("group", { name: en.lobbySeatLegend }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(radio("Healer 0/2"));
  });

  it("disables a full game role and says so in text", async () => {
    renderMembership();
    await open(en.lobbyJoin);

    const full = radio(en.lobbyRoleSlotFull("Tank", 1, 1));
    expect(full.disabled).toBe(true);
    expect(radio("Healer 0/2").disabled).toBe(false);
    expect(radio(en.lobbySeatFlex).disabled).toBe(false);
  });

  it("joins with the chosen game role and loads the lobby again", async () => {
    const { client, onChanged } = renderMembership();
    await open(en.lobbyJoin);

    fireEvent.click(radio("Healer 0/2"));
    submit(en.lobbySeatJoin);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.joinLobby).toHaveBeenCalledWith("g1", "l1", {
      gameRoleId: "r-heal",
    });
  });

  it("joins as flex", async () => {
    const { client, onChanged } = renderMembership();
    await open(en.lobbyJoin);

    fireEvent.click(radio(en.lobbySeatFlex));
    submit(en.lobbySeatJoin);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.joinLobby).toHaveBeenCalledWith("g1", "l1", { flex: true });
  });

  it("denies a join without a seat, tied to the choice", async () => {
    const { client } = renderMembership();
    await open(en.lobbyJoin);

    submit(en.lobbySeatJoin);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(en.lobbySeatMissing);
    expect(
      screen
        .getByRole("group", { name: en.lobbySeatLegend })
        .getAttribute("aria-describedby"),
    ).toBe(alert.id);
    expect(radio(en.lobbySeatFlex).getAttribute("aria-describedby")).toBe(
      alert.id,
    );
    expect(client.joinLobby).not.toHaveBeenCalled();
  });

  it("shows lobby_full in the seat choice and loads the lobby again", async () => {
    const { onChanged } = renderMembership(
      {},
      {
        joinLobby: vi.fn(() => Promise.reject(new ApiError(409, "lobby_full"))),
      },
    );
    await open(en.lobbyJoin);

    fireEvent.click(radio(en.lobbySeatFlex));
    submit(en.lobbySeatJoin);

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.lobby_full,
    );
    expect(onChanged).toHaveBeenCalled();
    expect(
      screen.getByRole("group", { name: en.lobbySeatLegend }),
    ).toBeTruthy();
  });

  it("keeps the choice open on game_role_full and loads the lobby again", async () => {
    const { onChanged } = renderMembership(
      {},
      {
        joinLobby: vi.fn(() =>
          Promise.reject(new ApiError(409, "game_role_full")),
        ),
      },
    );
    await open(en.lobbyJoin);

    fireEvent.click(radio("Healer 0/2"));
    submit(en.lobbySeatJoin);

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.game_role_full,
    );
    expect(onChanged).toHaveBeenCalled();
    expect(
      screen.getByRole("group", { name: en.lobbySeatLegend }),
    ).toBeTruthy();
  });

  it("shows invalid_game_role in lobby words", async () => {
    renderMembership(
      {},
      {
        joinLobby: vi.fn(() =>
          Promise.reject(new ApiError(400, "invalid_game_role")),
        ),
      },
    );
    await open(en.lobbyJoin);

    fireEvent.click(radio(en.lobbySeatFlex));
    submit(en.lobbySeatJoin);

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.lobbyErrors.invalid_game_role,
    );
  });

  it("closes the choice with cancel and returns focus to the join button", async () => {
    renderMembership();
    await open(en.lobbyJoin);

    submit(en.cancel);

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: en.lobbyJoin }),
      ),
    );
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("joins a lobby without game roles at once, as before", async () => {
    const client = fakeApiClient();
    render(
      <ApiProvider client={client}>
        <LobbyMembership
          groupId="g1"
          lobby={{ ...lobby, roleSlots: undefined }}
          onChanged={vi.fn()}
          onUnauthenticated={vi.fn()}
        />
      </ApiProvider>,
    );

    await open(en.lobbyJoin);

    expect(client.joinLobby).toHaveBeenCalledWith("g1", "l1");
    expect(screen.queryByRole("radio")).toBeNull();
  });
});

describe("changing seat", () => {
  it("offers a change of seat to a player whose seat is known", async () => {
    renderMembership({ joinedByMe: true, seat: "r-tank" });
    expect(
      await screen.findByRole("button", { name: en.lobbySeatChange }),
    ).toBeTruthy();
  });

  it("offers no change of seat when the seat is not known", async () => {
    renderMembership({ joinedByMe: true });
    await screen.findByRole("button", { name: en.lobbyLeave });
    expect(
      screen.queryByRole("button", { name: en.lobbySeatChange }),
    ).toBeNull();
  });

  it("keeps the player's own full game role open and checked", async () => {
    renderMembership({ joinedByMe: true, seat: "r-tank" });
    await open(en.lobbySeatChange);

    const own = radio("Tank 1/1");
    expect(own.disabled).toBe(false);
    expect(own.checked).toBe(true);
  });

  it("moves to another game role", async () => {
    const { client, onChanged } = renderMembership({
      joinedByMe: true,
      seat: "r-tank",
    });
    await open(en.lobbySeatChange);

    fireEvent.click(radio("Healer 0/2"));
    submit(en.lobbySeatSave);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.joinLobby).toHaveBeenCalledWith("g1", "l1", {
      gameRoleId: "r-heal",
    });
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("checks flex as the current seat of a flex player", async () => {
    renderMembership({ joinedByMe: true, seat: null });
    await open(en.lobbySeatChange);

    expect(radio(en.lobbySeatFlex).checked).toBe(true);
  });
});

describe("the lobby page", () => {
  it("lets a player move from the seat the page shows", async () => {
    const detail = {
      ...lobby,
      gameName: "WoW",
      gameGenre: null,
      maxPlayers: 3,
      startsAt: lobby.endsAt,
      createdByUserId: "u2",
      playerCount: 1,
      joinedByMe: true,
      players: [
        { userId: testUser.userId, displayName: "Maja", gameRoleId: "r-tank" },
      ],
    };
    const client = fakeApiClient({
      getLobby: vi.fn(() => Promise.resolve(detail)),
    });
    render(
      <ApiProvider client={client}>
        <LobbyDetailPage
          groupId="g1"
          lobbyId="l1"
          userId={testUser.userId}
          backHref="/groups/g1"
          onDeleted={vi.fn()}
          onUnauthenticated={vi.fn()}
        />
      </ApiProvider>,
    );

    await open(en.lobbySeatChange);

    expect(radio("Tank 1/1").checked).toBe(true);
  });
});
