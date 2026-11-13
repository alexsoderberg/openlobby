import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ApiProvider,
  type ApiClient,
  type PreferredGameRoleChoices,
} from "../../api";
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
  props: {
    joinedByMe?: boolean;
    seat?: string | null;
    roleSlots?: typeof roleSlots;
  } = {},
  overrides: Partial<ApiClient> = {},
) {
  const client = fakeApiClient(overrides);
  const onChanged = vi.fn();
  render(
    <ApiProvider client={client}>
      <LobbyMembership
        groupId="g1"
        lobby={{
          ...lobby,
          joinedByMe: props.joinedByMe ?? false,
          roleSlots: props.roleSlots ?? roleSlots,
        }}
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
/** Opens the seat form and waits for it: the join form shows once the preferred game roles are read. */
const openSeats = async (name: string) => {
  await open(name);
  await screen.findByRole("group", { name: en.lobbySeatLegend });
};
const submit = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("joining a lobby with game roles", () => {
  it("asks for a seat before it joins", async () => {
    const { client } = renderMembership();

    await openSeats(en.lobbyJoin);

    expect(client.joinLobby).not.toHaveBeenCalled();
    expect(
      screen.getByRole("group", { name: en.lobbySeatLegend }),
    ).toBeTruthy();
    expect(document.activeElement).toBe(radio("Healer 0/2"));
  });

  it("disables a full game role and says so in text", async () => {
    renderMembership();
    await openSeats(en.lobbyJoin);

    const full = radio(en.lobbyRoleSlotFull("Tank", 1, 1));
    expect(full.disabled).toBe(true);
    expect(radio("Healer 0/2").disabled).toBe(false);
    expect(radio(en.lobbySeatFlex).disabled).toBe(false);
  });

  it("joins with the chosen game role and loads the lobby again", async () => {
    const { client, onChanged } = renderMembership();
    await openSeats(en.lobbyJoin);

    fireEvent.click(radio("Healer 0/2"));
    submit(en.lobbySeatJoin);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.joinLobby).toHaveBeenCalledWith("g1", "l1", {
      gameRoleId: "r-heal",
    });
  });

  it("joins as flex", async () => {
    const { client, onChanged } = renderMembership();
    await openSeats(en.lobbyJoin);

    fireEvent.click(radio(en.lobbySeatFlex));
    submit(en.lobbySeatJoin);

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(client.joinLobby).toHaveBeenCalledWith("g1", "l1", { flex: true });
  });

  it("denies a join without a seat, tied to the choice", async () => {
    const { client } = renderMembership();
    await openSeats(en.lobbyJoin);

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
    await openSeats(en.lobbyJoin);

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
    await openSeats(en.lobbyJoin);

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
    await openSeats(en.lobbyJoin);

    fireEvent.click(radio(en.lobbySeatFlex));
    submit(en.lobbySeatJoin);

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.lobbyErrors.invalid_game_role,
    );
  });

  it("closes the choice with cancel and returns focus to the join button", async () => {
    renderMembership();
    await openSeats(en.lobbyJoin);

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
    expect(client.getPreferredGameRoles).not.toHaveBeenCalled();
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

/** A fake whose preferred game roles are the given IDs. */
const preferring = (...gameRoleIds: string[]): Partial<ApiClient> => ({
  getPreferredGameRoles: vi.fn(() =>
    Promise.resolve({ gameRoleIds, games: [] }),
  ),
});

describe("preselecting the seat from the preferred game roles", () => {
  it("checks and focuses the first preferred game role with a free slot, in lobby order", async () => {
    const { client } = renderMembership(
      {
        roleSlots: [
          ...roleSlots,
          { gameRoleId: "r-dps", name: "Damage", slots: 2, playerCount: 1 },
        ],
      },
      preferring("r-dps", "r-tank"),
    );
    await openSeats(en.lobbyJoin);

    expect(radio("Damage 1/2").checked).toBe(true);
    expect(radio("Healer 0/2").checked).toBe(false);
    expect(document.activeElement).toBe(radio("Damage 1/2"));
    submit(en.lobbySeatJoin);
    await waitFor(() =>
      expect(client.joinLobby).toHaveBeenCalledWith("g1", "l1", {
        gameRoleId: "r-dps",
      }),
    );
  });

  it("checks nothing, not even flex, when no preferred game role is free", async () => {
    renderMembership({}, preferring("r-tank"));
    await openSeats(en.lobbyJoin);

    expect(screen.queryByRole("radio", { checked: true })).toBeNull();
  });

  it("shows a player who has joined their current seat, without reading the choice", async () => {
    const { client } = renderMembership(
      { joinedByMe: true, seat: null },
      preferring("r-heal"),
    );
    await openSeats(en.lobbySeatChange);

    expect(radio(en.lobbySeatFlex).checked).toBe(true);
    expect(radio("Healer 0/2").checked).toBe(false);
    expect(client.getPreferredGameRoles).not.toHaveBeenCalled();
  });

  it("joins with the seat the player picks instead", async () => {
    const { client } = renderMembership({}, preferring("r-heal"));
    await openSeats(en.lobbyJoin);
    expect(radio("Healer 0/2").checked).toBe(true);

    fireEvent.click(radio(en.lobbySeatFlex));
    submit(en.lobbySeatJoin);

    await waitFor(() =>
      expect(client.joinLobby).toHaveBeenCalledWith("g1", "l1", { flex: true }),
    );
  });

  it("shows the form once a slow read has answered, with the seat preselected", async () => {
    let answer: (ids: string[]) => void = () => {};
    renderMembership(
      {},
      {
        getPreferredGameRoles: vi.fn(
          () =>
            new Promise<PreferredGameRoleChoices>((resolve) => {
              answer = (gameRoleIds) => resolve({ gameRoleIds, games: [] });
            }),
        ),
      },
    );
    await open(en.lobbyJoin);

    expect(screen.getByRole("status").textContent).toBe(
      en.preferredGameRoles.loading,
    );
    expect(screen.queryByRole("radio")).toBeNull();
    await act(async () => answer(["r-heal"]));

    expect(radio("Healer 0/2").checked).toBe(true);
    expect(document.activeElement).toBe(radio("Healer 0/2"));
  });

  it("does not read the choice before the seat form opens", async () => {
    const { client } = renderMembership({}, preferring("r-heal"));
    await screen.findByRole("button", { name: en.lobbyJoin });

    expect(client.getPreferredGameRoles).not.toHaveBeenCalled();
  });

  it("says no seat is chosen when the choice cannot be read", async () => {
    renderMembership(
      {},
      {
        getPreferredGameRoles: vi.fn(() =>
          Promise.reject(new ApiError(500, "internal_error")),
        ),
      },
    );
    await openSeats(en.lobbyJoin);

    expect(screen.getByText(en.lobbySeatNotPreselected)).toBeTruthy();
    expect(screen.queryByRole("radio", { checked: true })).toBeNull();
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
