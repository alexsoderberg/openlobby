import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, ApiProvider, type ApiClient, type Game } from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { CreateLobby } from "./CreateLobby";

// Wednesday 4 November 2026, 12:00 local time.
const NOW = new Date(2026, 10, 4, 12, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const roles = [
  { id: "r-tank", name: "Tank", slots: 1 },
  { id: "r-heal", name: "Healer", slots: 1 },
  { id: "r-dps", name: "Damage", slots: 3 },
];
const wow: Game = {
  id: "g-wow",
  name: "WoW",
  defaultMaxPlayers: 8,
  genre: null,
  gameRoles: [],
  modes: [
    {
      id: "m-raid",
      name: "Raid",
      maxPlayers: 5,
      gameRoles: roles,
      activities: [{ id: "a-citadel", name: "Citadel" }],
    },
    {
      id: "m-arena",
      name: "Arena",
      maxPlayers: 3,
      gameRoles: [],
      activities: [],
    },
  ],
};
const dungeon: Game = {
  id: "g-dungeon",
  name: "Dungeon",
  defaultMaxPlayers: 5,
  genre: null,
  gameRoles: roles,
  modes: [],
};
const catan: Game = {
  id: "g-catan",
  name: "Catan",
  defaultMaxPlayers: 4,
  genre: null,
};

function renderForm(overrides: Partial<ApiClient> = {}) {
  const client = fakeApiClient({
    listGroupGames: vi.fn(() => Promise.resolve([catan, wow, dungeon])),
    createLobby: vi.fn(() =>
      Promise.resolve({
        id: "new",
        gameName: "WoW",
        gameGenre: null,
        maxPlayers: 5,
        startsAt: "",
        endsAt: "",
        createdByUserId: "u1",
        playerCount: 1,
        joinedByMe: true,
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
        onCancel={vi.fn()}
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
const seat = (name: string) =>
  screen.getByRole<HTMLInputElement>("radio", { name });

/** Fills the times and picks WoW, then the mode when one is given. */
async function fillWow(mode?: string) {
  set(await field(en.lobbyGameLabel), "g-wow");
  set(await field(en.lobbyDateLabel), "2026-11-05");
  set(await field(en.lobbyStartLabel), "18:00");
  set(await field(en.lobbyEndLabel), "20:00");
  if (mode) set(await field(en.lobbyModeLabel), mode);
}

describe("mode and activity", () => {
  it("offers modes only for a game with modes, and activities only for the chosen mode", async () => {
    renderForm();
    set(await field(en.lobbyGameLabel), "g-catan");
    expect(screen.queryByLabelText(en.lobbyModeLabel)).toBeNull();

    set(await field(en.lobbyGameLabel), "g-wow");
    const mode = await field(en.lobbyModeLabel);
    expect(Array.from(mode.options, (option) => option.text)).toEqual([
      en.lobbyModeNone,
      "Raid",
      "Arena",
    ]);
    expect(screen.queryByLabelText(en.lobbyActivityLabel)).toBeNull();

    set(mode, "m-raid");
    const activity = await field(en.lobbyActivityLabel);
    expect(Array.from(activity.options, (option) => option.text)).toEqual([
      en.lobbyActivityNone,
      "Citadel",
    ]);
    set(mode, "m-arena");
    expect(screen.queryByLabelText(en.lobbyActivityLabel)).toBeNull();
  });

  it("forgets the mode when the game changes", async () => {
    renderForm();
    set(await field(en.lobbyGameLabel), "g-wow");
    set(await field(en.lobbyModeLabel), "m-raid");

    set(await field(en.lobbyGameLabel), "g-catan");
    set(await field(en.lobbyGameLabel), "g-wow");

    expect((await field(en.lobbyModeLabel)).value).toBe("");
  });

  it("fills max players from a mode without game roles", async () => {
    renderForm();
    await fillWow("m-arena");

    expect((await field(en.lobbyMaxPlayersLabel)).value).toBe("3");
  });

  it("sends the mode and no activity for a mode without game roles", async () => {
    const { client, onCreated } = renderForm();
    await fillWow("m-arena");

    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(client.createLobby).toHaveBeenCalledWith("g1", {
      gameId: "g-wow",
      modeId: "m-arena",
      maxPlayers: 3,
      startsAt: new Date(2026, 10, 5, 18).toISOString(),
      endsAt: new Date(2026, 10, 5, 20).toISOString(),
    });
  });
});

describe("max players with modes", () => {
  it("does not fill max players from the default of a game with modes", async () => {
    renderForm();
    await fillWow();

    expect((await field(en.lobbyMaxPlayersLabel)).value).toBe("");
  });

  it("refuses an empty max players for a mode and does not send", async () => {
    const { client } = renderForm();
    await fillWow("m-arena");
    set(await field(en.lobbyMaxPlayersLabel), "");

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.lobbyModeMaxPlayersInvalid,
    );
    expect(document.activeElement).toBe(await field(en.lobbyMaxPlayersLabel));
    expect(client.createLobby).not.toHaveBeenCalled();
  });

  it("shows a refused capacity of a mode without game roles at max players", async () => {
    renderForm({
      createLobby: vi.fn(() =>
        Promise.reject(new ApiError(400, "invalid_capacity")),
      ),
    });
    await fillWow("m-arena");

    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(en.lobbyModeMaxPlayersInvalid);
    const target = await field(en.lobbyMaxPlayersLabel);
    expect(document.activeElement).toBe(target);
    expect(target.getAttribute("aria-describedby")).toContain(alert.id);
  });
});

describe("game roles", () => {
  it("prefills the role slots from the mode and shows their total instead of max players", async () => {
    renderForm();
    await fillWow("m-raid");

    expect((await field("Tank, slots")).value).toBe("1");
    expect((await field("Damage, slots")).value).toBe("3");
    expect(screen.getByText(en.lobbyRolesTotal(5))).toBeTruthy();
    expect(screen.queryByLabelText(en.lobbyMaxPlayersLabel)).toBeNull();

    set(await field("Damage, slots"), "2");
    expect(screen.getByText(en.lobbyRolesTotal(4))).toBeTruthy();
  });

  it("prefills the role slots from a game without modes", async () => {
    renderForm();
    set(await field(en.lobbyGameLabel), "g-dungeon");

    expect((await field("Healer, slots")).value).toBe("1");
    expect(screen.queryByLabelText(en.lobbyModeLabel)).toBeNull();
  });

  it("offers no game roles for a game with modes until a mode is chosen", async () => {
    renderForm();
    await fillWow();

    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("sends the mode, activity, changed slots and the creator's game role", async () => {
    const { client, onCreated } = renderForm();
    await fillWow("m-raid");
    set(await field(en.lobbyActivityLabel), "a-citadel");
    set(await field("Damage, slots"), "2");
    fireEvent.click(seat("Healer"));

    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(client.createLobby).toHaveBeenCalledWith("g1", {
      gameId: "g-wow",
      modeId: "m-raid",
      activityId: "a-citadel",
      roleSlots: [
        { gameRoleId: "r-tank", slots: 1 },
        { gameRoleId: "r-heal", slots: 1 },
        { gameRoleId: "r-dps", slots: 2 },
      ],
      gameRoleId: "r-heal",
      startsAt: new Date(2026, 10, 5, 18).toISOString(),
      endsAt: new Date(2026, 10, 5, 20).toISOString(),
    });
  });

  it("sends flex as the creator's seat", async () => {
    const { client, onCreated } = renderForm();
    await fillWow("m-raid");
    fireEvent.click(seat(en.lobbySeatFlex));

    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(client.createLobby).toHaveBeenCalledWith(
      "g1",
      expect.objectContaining({ flex: true }),
    );
  });

  it("denies a missing seat next to the seat choice and focuses it", async () => {
    const { client } = renderForm();
    await fillWow("m-raid");

    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(en.lobbySeatMissing);
    expect(document.activeElement).toBe(seat("Tank"));
    expect(seat("Tank").getAttribute("aria-invalid")).toBe("true");
    expect(seat("Healer").getAttribute("aria-describedby")).toContain(alert.id);
    expect(
      screen
        .getByRole("group", { name: en.lobbySeatLegend })
        .getAttribute("aria-describedby"),
    ).toContain(alert.id);
    expect(client.createLobby).not.toHaveBeenCalled();
  });

  it("disables the seat of a game role with 0 slots and sends the 0", async () => {
    const { client, onCreated } = renderForm();
    await fillWow("m-raid");
    set(await field("Tank, slots"), "0");
    expect(seat("Tank").disabled).toBe(true);
    fireEvent.click(seat("Healer"));

    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(client.createLobby).toHaveBeenCalledWith(
      "g1",
      expect.objectContaining({
        roleSlots: expect.arrayContaining([{ gameRoleId: "r-tank", slots: 0 }]),
      }),
    );
  });

  it("clears the seat when its game role goes to 0 slots", async () => {
    renderForm();
    await fillWow("m-raid");
    fireEvent.click(seat("Tank"));

    set(await field("Tank, slots"), "0");

    expect(seat("Tank").checked).toBe(false);
  });

  it("denies slots that are not whole numbers, with the slots text", async () => {
    const { client } = renderForm();
    await fillWow("m-raid");
    set(await field("Damage, slots"), "-1");
    fireEvent.click(seat("Healer"));

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.lobbySlotsInvalid,
    );
    expect(document.activeElement).toBe(await field("Tank, slots"));
    expect(client.createLobby).not.toHaveBeenCalled();
  });
});

describe("server errors of mode, activity and seat", () => {
  async function refused(code: string) {
    renderForm({
      createLobby: vi.fn(() => Promise.reject(new ApiError(400, code))),
    });
    await fillWow("m-raid");
    fireEvent.click(seat("Tank"));
    submit();
    return screen.findByRole("alert");
  }

  it.each([
    ["invalid_mode", en.lobbyModeLabel, en.lobbyErrors.invalid_mode],
    [
      "invalid_activity",
      en.lobbyActivityLabel,
      en.lobbyErrors.invalid_activity,
    ],
    ["invalid_capacity", "Tank, slots", en.lobbySlotsInvalid],
  ])(
    "shows %s in lobby words and focuses its field",
    async (code, label, text) => {
      const alert = await refused(code);

      expect(alert.textContent).toBe(text);
      const target = await field(label);
      expect(document.activeElement).toBe(target);
      expect(target.getAttribute("aria-describedby")).toContain(alert.id);
    },
  );

  it("shows invalid_game_role in lobby words at the seat choice", async () => {
    const alert = await refused("invalid_game_role");

    expect(alert.textContent).toBe(en.lobbyErrors.invalid_game_role);
    expect(document.activeElement).toBe(seat("Tank"));
  });
});
