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

const raid = {
  id: "m1",
  name: "Raid",
  maxPlayers: 4,
  gameRoles: [
    { id: "r1", name: "Tank", slots: 1 },
    { id: "r2", name: "Healer", slots: 3 },
  ],
  activities: [{ id: "a1", name: "Crypt" }],
};
const duel = {
  id: "m2",
  name: "Duel",
  maxPlayers: 2,
  gameRoles: [],
  activities: [],
};
const dungeons: Game = {
  id: "g1",
  name: "Dungeons",
  defaultMaxPlayers: 6,
  genre: null,
  gameRoles: [{ id: "r9", name: "Scout", slots: 6 }],
  modes: [raid, duel],
};
const catan: Game = {
  id: "g2",
  name: "Catan",
  defaultMaxPlayers: 4,
  genre: null,
};

function renderPage(overrides: Partial<ApiClient> = {}) {
  const client = fakeApiClient({
    listGames: vi.fn(() => Promise.resolve([dungeons, catan])),
    ...overrides,
  });
  render(
    <ApiProvider client={client}>
      <GamesPage isSystemAdmin onUnauthenticated={vi.fn()} />
    </ApiProvider>,
  );
  return client;
}

async function addForm() {
  await screen.findByText("Catan");
  return screen
    .getByRole("heading", { name: en.gameAddHeading })
    .closest("section")!;
}

async function editForm(name: string) {
  await screen.findByText(name);
  fireEvent.click(
    screen.getByRole("button", { name: `${en.gameEdit}, ${name}` }),
  );
  return screen
    .getByRole("button", { name: en.gameEditSubmit })
    .closest("form")!;
}

const type = (field: HTMLElement, value: string) =>
  fireEvent.change(field, { target: { value } });

const click = (scope: HTMLElement, name: string) =>
  fireEvent.click(within(scope).getByRole("button", { name }));

/** The open mode's view. Only one is open at a time. */
const modeView = (scope: HTMLElement) => within(scope).getByRole("region");

/** Opens a mode from its row in the game view. */
function openMode(scope: HTMLElement, name: string) {
  click(scope, name);
  return modeView(scope);
}

const back = (scope: HTMLElement) => click(scope, en.gameModeBack);

function fillName(scope: HTMLElement, name: string) {
  type(within(scope).getAllByLabelText(en.gameNameLabel)[0], name);
}

async function answer(name: string) {
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", { name }),
  );
}

describe("add with modes", () => {
  it("adds a mode with a max players value, hides the default max and sends the entered arrays", async () => {
    const client = renderPage();
    const form = await addForm();
    fillName(form, "Azul");

    expect(within(form).getByLabelText(en.gameMaxPlayersLabel)).toBeTruthy();
    click(form, en.gameModeAdd);

    const mode = modeView(form);
    expect(document.activeElement).toBe(
      within(mode).getByLabelText(en.gameModeNameLabel),
    );
    type(within(mode).getByLabelText(en.gameModeNameLabel), " Solo ");
    type(within(mode).getByLabelText(en.gameModeMaxLabel), "2");
    back(form);

    expect(within(form).queryByLabelText(en.gameMaxPlayersLabel)).toBeNull();
    click(form, en.gameAddSubmit);

    await waitFor(() =>
      expect(client.createGame).toHaveBeenCalledWith({
        name: "Azul",
        defaultMaxPlayers: null,
        genre: null,
        modes: [{ name: "Solo", maxPlayers: 2, gameRoles: [], activities: [] }],
      }),
    );
  });

  it("gives a mode game roles instead of a max players value and sends their slots", async () => {
    const client = renderPage();
    const form = await addForm();
    fillName(form, "Azul");
    click(form, en.gameModeAdd);
    const mode = modeView(form);
    type(within(mode).getByLabelText(en.gameModeNameLabel), "Raid");

    click(mode, en.gameRoleAdd);
    const role = within(mode).getByRole("group", {
      name: en.gameRoleLegend(1),
    });
    expect(document.activeElement).toBe(
      within(role).getByLabelText(en.gameRoleNameLabel),
    );
    type(within(role).getByLabelText(en.gameRoleNameLabel), "Tank");
    type(within(role).getByLabelText(en.gameRoleSlotsLabel), "2");

    expect(within(mode).queryByLabelText(en.gameModeMaxLabel)).toBeNull();
    expect(within(mode).getByText(en.gameRolesTotal(2))).toBeTruthy();
    click(mode, en.gameActivityAdd);
    type(within(mode).getByLabelText(en.gameActivityNameLabel), "Crypt");
    back(form);
    expect(within(form).getByText(en.gameModeSummary(2, 1))).toBeTruthy();
    click(form, en.gameAddSubmit);

    await waitFor(() =>
      expect(client.createGame).toHaveBeenCalledWith(
        expect.objectContaining({
          modes: [
            {
              name: "Raid",
              maxPlayers: null,
              gameRoles: [{ name: "Tank", slots: 2 }],
              activities: [{ name: "Crypt" }],
            },
          ],
        }),
      ),
    );
  });

  it("puts game roles on a game without modes and hides the default max", async () => {
    const client = renderPage();
    const form = await addForm();
    fillName(form, "Azul");

    click(form, en.gameRoleAdd);
    expect(within(form).queryByLabelText(en.gameMaxPlayersLabel)).toBeNull();
    type(within(form).getByLabelText(en.gameRoleNameLabel), "Scout");
    click(form, en.gameAddSubmit);

    await waitFor(() =>
      expect(client.createGame).toHaveBeenCalledWith({
        name: "Azul",
        defaultMaxPlayers: null,
        genre: null,
        gameRoles: [{ name: "Scout", slots: 1 }],
        modes: [],
      }),
    );
  });

  it("moves focus to the add button after a game role is removed, and shows the default max again", async () => {
    renderPage();
    const form = await addForm();
    click(form, en.gameRoleAdd);

    click(form, `${en.gameRoleRemove}, ${en.gameRoleLegend(1)}`);

    expect(document.activeElement).toBe(
      within(form).getByRole("button", { name: en.gameRoleAdd }),
    );
    expect(within(form).getByLabelText(en.gameMaxPlayersLabel)).toBeTruthy();
  });

  it("offers game roles on the game only while it has no modes", async () => {
    renderPage();
    const form = await addForm();
    expect(within(form).getAllByText(en.gameRolesLegend)).toHaveLength(1);

    click(form, en.gameModeAdd);
    // The only game roles left are the mode's own.
    expect(within(modeView(form)).getByText(en.gameRolesLegend)).toBeTruthy();
    back(form);
    expect(within(form).queryByText(en.gameRolesLegend)).toBeNull();
  });
});

describe("one level at a time", () => {
  it("opens a mode in its own view with focus on its heading, and goes back to its row", async () => {
    renderPage();
    const form = await editForm("Dungeons");
    type(within(form).getByLabelText(en.gameNameLabel), "Dungeons 2");
    expect(within(form).getByText(en.gameModeSummary(4, 1))).toBeTruthy();
    expect(within(form).getByText(en.gameModeSummary(2, 0))).toBeTruthy();

    const mode = openMode(form, "Raid");

    expect(document.activeElement).toBe(
      within(mode).getByRole("heading", { name: "Raid" }),
    );
    // The game's own fields, the other modes and the save button are out of sight while a mode is open.
    expect(
      within(form).queryByRole("textbox", { name: en.gameNameLabel }),
    ).toBeNull();
    expect(within(form).queryByRole("button", { name: "Duel" })).toBeNull();
    expect(
      within(form).queryByRole("button", { name: en.gameEditSubmit }),
    ).toBeNull();

    back(form);

    expect(within(form).queryByRole("region")).toBeNull();
    expect(document.activeElement).toBe(
      within(form).getByRole("button", { name: "Raid" }),
    );
    // The game's fields stayed in the form, so what was typed is kept.
    expect(
      within(form).getByRole("textbox", { name: en.gameNameLabel }),
    ).toHaveProperty("value", "Dungeons 2");
  });

  it("keeps focus in the field being typed in, and does not apply an earlier focus request again", async () => {
    renderPage();
    const form = await editForm("Dungeons");
    openMode(form, "Raid");
    back(form);
    // Back asked for focus on the Raid row, and the row got it.
    expect(document.activeElement).toBe(
      within(form).getByRole("button", { name: "Raid" }),
    );
    const name = within(openMode(form, "Raid")).getByLabelText(
      en.gameModeNameLabel,
    );
    name.focus();

    for (const text of ["R", "Ra", "Rai", "Raid 2"]) {
      type(name, text);
      expect(document.activeElement).toBe(name);
    }
    expect(name).toHaveProperty("value", "Raid 2");
  });

  it("keeps the edits made in a mode in the form until the game is saved", async () => {
    const client = renderPage();
    const form = await editForm("Dungeons");
    type(
      within(openMode(form, "Duel")).getByLabelText(en.gameModeNameLabel),
      "Duo",
    );
    back(form);

    expect(client.replaceGame).not.toHaveBeenCalled();
    expect(within(openMode(form, "Duo")).getByDisplayValue("Duo")).toBeTruthy();
  });
});

describe("remove a mode or an activity", () => {
  it("asks before removing a mode, keeps it on Keep, and removes it on confirm", async () => {
    const client = renderPage();
    const form = await editForm("Dungeons");
    const mode = openMode(form, "Raid");

    click(mode, `${en.gameModeRemove}, Raid`);
    await screen.findByRole("dialog", {
      name: en.gameModeRemoveHeading("Raid"),
    });
    await answer(en.gameModeRemoveKeep);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(mode).getByDisplayValue("Raid")).toBeTruthy();

    click(mode, `${en.gameModeRemove}, Raid`);
    await answer(en.gameModeRemoveSubmit);
    await waitFor(() => expect(within(form).queryByRole("region")).toBeNull());
    expect(within(form).queryByRole("button", { name: "Raid" })).toBeNull();
    expect(document.activeElement).toBe(
      within(form).getByRole("button", { name: en.gameModeAdd }),
    );
    expect(client.replaceGame).not.toHaveBeenCalled();

    click(form, en.gameEditSubmit);
    await waitFor(() =>
      expect(client.replaceGame).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({
          modes: [expect.objectContaining({ id: "m2", name: "Duel" })],
        }),
      ),
    );
  });

  it("shows the game's own roles again after the last mode is removed and sends their sum as no default", async () => {
    const client = renderPage({
      listGames: () => Promise.resolve([{ ...dungeons, modes: [duel] }, catan]),
    });
    const form = await editForm("Dungeons");
    expect(within(form).queryByLabelText(en.gameMaxPlayersLabel)).toBeNull();

    click(openMode(form, "Duel"), `${en.gameModeRemove}, Duel`);
    await answer(en.gameModeRemoveSubmit);

    // Game roles on the game apply again, so the max stays hidden and the roles show.
    await waitFor(() =>
      expect(within(form).getByDisplayValue("Scout")).toBeTruthy(),
    );
    click(form, en.gameEditSubmit);
    await waitFor(() =>
      expect(client.replaceGame).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({
          defaultMaxPlayers: null,
          gameRoles: [{ id: "r9", name: "Scout", slots: 6 }],
          modes: [],
        }),
      ),
    );
  });

  it("shows the stored default max again after the last mode of a game without game roles is removed", async () => {
    const client = renderPage({
      listGames: () =>
        Promise.resolve([{ ...dungeons, gameRoles: [], modes: [duel] }, catan]),
    });
    const form = await editForm("Dungeons");
    expect(within(form).queryByLabelText(en.gameMaxPlayersLabel)).toBeNull();

    click(openMode(form, "Duel"), `${en.gameModeRemove}, Duel`);
    await answer(en.gameModeRemoveSubmit);

    await waitFor(() =>
      expect(
        within(form).getByLabelText(en.gameMaxPlayersLabel),
      ).toHaveProperty("value", "6"),
    );
    click(form, en.gameEditSubmit);
    await waitFor(() =>
      expect(client.replaceGame).toHaveBeenCalledWith(
        "g1",
        expect.objectContaining({
          defaultMaxPlayers: 6,
          gameRoles: [],
          modes: [],
        }),
      ),
    );
  });

  it("keeps the activity when Keep is chosen", async () => {
    renderPage();
    const form = await editForm("Dungeons");
    const mode = openMode(form, "Raid");
    click(mode, `${en.gameActivityRemove}, Crypt`);

    await answer(en.gameActivityRemoveKeep);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(mode).getByDisplayValue("Crypt")).toBeTruthy();
  });

  it("asks before removing an activity and focuses its add button after", async () => {
    renderPage();
    const form = await editForm("Dungeons");
    const mode = openMode(form, "Raid");

    click(mode, `${en.gameActivityRemove}, Crypt`);
    await screen.findByRole("dialog", {
      name: en.gameActivityRemoveHeading("Crypt"),
    });
    expect(within(mode).getByDisplayValue("Crypt")).toBeTruthy();
    await answer(en.gameActivityRemoveSubmit);

    await waitFor(() =>
      expect(within(mode).queryByDisplayValue("Crypt")).toBeNull(),
    );
    expect(document.activeElement).toBe(
      within(mode).getByRole("button", { name: en.gameActivityAdd }),
    );
  });
});

describe("edit with modes", () => {
  it("shows the stored entries, hides the default max and keeps the game's own max and roles", async () => {
    const client = renderPage();
    const form = await editForm("Dungeons");

    expect(within(form).queryByLabelText(en.gameMaxPlayersLabel)).toBeNull();
    const mode = openMode(form, "Raid");
    expect(within(mode).getByDisplayValue("Tank")).toBeTruthy();
    expect(within(mode).getByText(en.gameRolesTotal(4))).toBeTruthy();
    expect(within(mode).queryByLabelText(en.gameModeMaxLabel)).toBeNull();
    type(within(mode).getByDisplayValue("Healer"), "Medic");
    back(form);
    expect(
      within(openMode(form, "Duel")).getByLabelText(en.gameModeMaxLabel),
    ).toHaveProperty("value", "2");
    back(form);

    click(form, en.gameEditSubmit);

    await waitFor(() => expect(client.replaceGame).toHaveBeenCalledOnce());
    const [, input] = vi.mocked(client.replaceGame).mock.calls[0];
    expect(input.defaultMaxPlayers).toBe(6);
    expect(input).not.toHaveProperty("gameRoles", expect.anything());
    expect(input.modes).toEqual([
      {
        id: "m1",
        name: "Raid",
        maxPlayers: null,
        gameRoles: [
          { id: "r1", name: "Tank", slots: 1 },
          { id: "r2", name: "Medic", slots: 3 },
        ],
        activities: [{ id: "a1", name: "Crypt" }],
      },
      { id: "m2", name: "Duel", maxPlayers: 2, gameRoles: [], activities: [] },
    ]);
  });

  it("sends empty arrays for a game without entries so that none are added by accident", async () => {
    const client = renderPage();
    const form = await editForm("Catan");
    click(form, en.gameEditSubmit);
    await waitFor(() =>
      expect(client.replaceGame).toHaveBeenCalledWith("g2", {
        name: "Catan",
        defaultMaxPlayers: 4,
        genre: null,
        gameRoles: [],
        modes: [],
      }),
    );
  });
});

describe("errors", () => {
  it.each([
    ["invalid_mode", en.errors.invalid_mode],
    ["mode_taken", en.errors.mode_taken],
    ["invalid_activity", en.errors.invalid_activity],
    ["activity_taken", en.errors.activity_taken],
    ["invalid_game_role", en.errors.invalid_game_role],
    ["game_role_taken", en.errors.game_role_taken],
    ["invalid_capacity", en.gameStructureCapacityInvalid],
  ])("shows %s tied to the modes", async (code, text) => {
    renderPage({
      replaceGame: () => Promise.reject(new ApiError(400, code)),
    });
    const form = await editForm("Dungeons");
    click(form, en.gameEditSubmit);

    const alert = await within(form).findByRole("alert");
    expect(alert.textContent).toBe(text);
    const modes = within(form)
      .getByText(en.gameModesLegend)
      .closest("fieldset")!;
    expect(modes.getAttribute("aria-describedby")).toBe(alert.id);
    expect(modes.contains(document.activeElement)).toBe(true);
  });

  it("ties a game role error to the game's own roles when the game has no modes", async () => {
    renderPage({
      createGame: () => Promise.reject(new ApiError(400, "invalid_game_role")),
    });
    const form = await addForm();
    fillName(form, "Azul");
    click(form, en.gameRoleAdd);
    type(within(form).getByLabelText(en.gameRoleNameLabel), "Scout");
    click(form, en.gameAddSubmit);

    const alert = await within(form).findByRole("alert");
    expect(alert.textContent).toBe(en.errors.invalid_game_role);
    const roles = within(form)
      .getByText(en.gameRolesLegend)
      .closest("fieldset")!;
    expect(roles.getAttribute("aria-describedby")).toBe(alert.id);
    expect(document.activeElement).toBe(
      within(form).getByLabelText(en.gameRoleNameLabel),
    );
  });

  it.each([
    ["a mode name", en.gameModeNameLabel, "invalid_mode"],
    ["an activity name", en.gameActivityNameLabel, "invalid_activity"],
  ])(
    "checks %s locally, opens its mode and focuses that entry",
    async (_, label, code) => {
      const client = renderPage();
      const form = await addForm();
      fillName(form, "Azul");
      click(form, en.gameModeAdd);
      const mode = modeView(form);
      type(within(mode).getByLabelText(en.gameModeNameLabel), "Raid");
      type(within(mode).getByLabelText(en.gameModeMaxLabel), "4");
      click(mode, en.gameActivityAdd);
      if (label === en.gameModeNameLabel)
        type(within(mode).getByLabelText(label), "");
      back(form);
      click(form, en.gameAddSubmit);

      const alert = await within(form).findByRole("alert");
      expect(alert.textContent).toBe(en.errors[code as "invalid_mode"]);
      const field = within(modeView(form)).getByLabelText(label);
      expect(document.activeElement).toBe(field);
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(field.getAttribute("aria-describedby")).toContain(alert.id);
      // The entry is known, so the section is not described as well.
      expect(
        within(form)
          .getByText(en.gameModesLegend)
          .closest("fieldset")!
          .getAttribute("aria-describedby"),
      ).toBeNull();
      expect(client.createGame).not.toHaveBeenCalled();
    },
  );

  it("marks the row of the mode a local failure is in", async () => {
    renderPage();
    const form = await addForm();
    fillName(form, "Azul");
    click(form, en.gameModeAdd);
    type(within(modeView(form)).getByLabelText(en.gameModeNameLabel), "Raid");
    type(within(modeView(form)).getByLabelText(en.gameModeMaxLabel), "4");
    back(form);
    click(form, en.gameModeAdd);
    back(form);
    click(form, en.gameAddSubmit);

    const alert = await within(form).findByRole("alert");
    expect(
      within(modeView(form)).getByRole("heading", {
        name: en.gameModeLegend(2),
      }),
    ).toBeTruthy();
    back(form);

    const row = within(form).getByRole("button", {
      name: en.gameModeLegend(2),
    });
    expect(within(row).getByText(en.gameModeHasError)).toBeTruthy();
    expect(row.getAttribute("aria-describedby")).toContain(alert.id);
    expect(
      within(form)
        .getByRole("button", { name: "Raid" })
        .getAttribute("aria-describedby"),
    ).not.toContain(alert.id);
  });

  it("checks the slots and the mode max locally with the structure text", async () => {
    const client = renderPage();
    const form = await addForm();
    fillName(form, "Azul");
    click(form, en.gameModeAdd);
    type(within(modeView(form)).getByLabelText(en.gameModeNameLabel), "Raid");
    back(form);
    click(form, en.gameAddSubmit);

    expect((await within(form).findByRole("alert")).textContent).toBe(
      en.gameStructureCapacityInvalid,
    );
    expect(document.activeElement).toBe(
      within(modeView(form)).getByLabelText(en.gameModeMaxLabel),
    );
    expect(client.createGame).not.toHaveBeenCalled();
  });
});
