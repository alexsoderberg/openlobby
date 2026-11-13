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
  type PreferredGameRoleChoices,
} from "../../api";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { PreferredGameRoles } from "./PreferredGameRoles";

const m = en.preferredGameRoles;

const choices: PreferredGameRoleChoices = {
  gameRoleIds: ["scout"],
  games: [
    {
      id: "drg",
      name: "Deep Rock Galactic",
      defaultMaxPlayers: 4,
      genre: null,
      gameRoles: [
        { id: "scout", name: "Scout", slots: 1 },
        { id: "driller", name: "Driller", slots: 1 },
      ],
      modes: [],
    },
    {
      id: "ow",
      name: "Overwatch",
      defaultMaxPlayers: 5,
      genre: null,
      gameRoles: [],
      modes: [
        {
          id: "ranked",
          name: "Ranked",
          maxPlayers: 5,
          activities: [],
          gameRoles: [
            { id: "tank", name: "Tank", slots: 1 },
            { id: "support", name: "Support", slots: 2 },
          ],
        },
      ],
    },
  ],
};

function renderSection(overrides: Partial<ApiClient> = {}) {
  const client = fakeApiClient({
    getPreferredGameRoles: vi.fn(() => Promise.resolve(choices)),
    ...overrides,
  });
  render(
    <ApiProvider client={client}>
      <PreferredGameRoles onUnauthenticated={vi.fn()} />
    </ApiProvider>,
  );
  return client;
}

const box = (name: string) =>
  screen.getByRole("checkbox", { name }) as HTMLInputElement;
const save = () =>
  fireEvent.click(screen.getByRole("button", { name: m.save }));

describe("PreferredGameRoles", () => {
  it("names the form after the section heading", async () => {
    renderSection();

    expect(await screen.findByRole("form", { name: m.heading })).toBeTruthy();
  });

  it("shows loading, then each game as a group with its game roles and the saved choice ticked", async () => {
    renderSection();

    expect(screen.getByRole("status").textContent).toBe(m.loading);
    const drg = await screen.findByRole("group", {
      name: "Deep Rock Galactic",
    });
    expect(
      within(drg)
        .getAllByRole("checkbox")
        .map((input) => input.getAttribute("value")),
    ).toEqual(["scout", "driller"]);
    expect(box("Scout").checked).toBe(true);
    expect(box("Driller").checked).toBe(false);
  });

  it("names a game role of a mode with the mode name", async () => {
    renderSection();

    const overwatch = await screen.findByRole("group", { name: "Overwatch" });
    expect(
      within(overwatch).getByRole("checkbox", {
        name: m.roleWithMode("Tank", "Ranked"),
      }),
    ).toBeTruthy();
  });

  it("says so when no game has game roles", async () => {
    renderSection({
      getPreferredGameRoles: vi.fn(() =>
        Promise.resolve({ gameRoleIds: [], games: [] }),
      ),
    });

    expect(await screen.findByText(m.empty)).toBeTruthy();
    expect(screen.queryByRole("button", { name: m.save })).toBeNull();
  });

  it("saves the ticked game roles and moves focus to the confirmation", async () => {
    const client = renderSection();
    await screen.findByRole("group", { name: "Overwatch" });

    fireEvent.click(box(m.roleWithMode("Tank", "Ranked")));
    save();

    const status = await screen.findByText(m.saved);
    expect(client.replacePreferredGameRoles).toHaveBeenCalledWith([
      "scout",
      "tank",
    ]);
    expect(document.activeElement).toBe(status);
  });

  it("shows the saved choice when the list is opened again", async () => {
    let savedIds = choices.gameRoleIds;
    const client = fakeApiClient({
      getPreferredGameRoles: vi.fn(() =>
        Promise.resolve({ ...choices, gameRoleIds: savedIds }),
      ),
      replacePreferredGameRoles: vi.fn((gameRoleIds: string[]) => {
        savedIds = gameRoleIds;
        return Promise.resolve({ ...choices, gameRoleIds });
      }),
    });
    const section = (
      <ApiProvider client={client}>
        <PreferredGameRoles onUnauthenticated={vi.fn()} />
      </ApiProvider>
    );
    const { unmount } = render(section);
    await screen.findByRole("group", { name: "Overwatch" });
    fireEvent.click(box(m.roleWithMode("Tank", "Ranked")));
    save();
    await screen.findByText(m.saved);
    unmount();

    render(section);

    await screen.findByRole("group", { name: "Overwatch" });
    expect(box(m.roleWithMode("Tank", "Ranked")).checked).toBe(true);
    expect(box("Scout").checked).toBe(true);
    expect(box("Driller").checked).toBe(false);
  });

  it("clears the choice with an empty list", async () => {
    const client = renderSection();
    await screen.findByRole("group", { name: "Overwatch" });

    fireEvent.click(box("Scout"));
    save();

    await screen.findByText(m.saved);
    expect(client.replacePreferredGameRoles).toHaveBeenCalledWith([]);
  });

  it("on a removed game role, says so, loads the list again and keeps the other ticks for the next save", async () => {
    const withoutTank = {
      ...choices,
      games: [
        choices.games[0],
        {
          ...choices.games[1],
          modes: [
            {
              ...choices.games[1].modes![0],
              gameRoles: [{ id: "support", name: "Support", slots: 2 }],
            },
          ],
        },
      ],
    };
    let answerReload: (value: PreferredGameRoleChoices) => void = () => {};
    const getPreferredGameRoles = vi
      .fn()
      .mockResolvedValueOnce(choices)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answerReload = resolve;
        }),
      );
    const replacePreferredGameRoles = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(400, "invalid_game_role"))
      .mockResolvedValueOnce({ gameRoleIds: ["scout"], games: [] });
    renderSection({ getPreferredGameRoles, replacePreferredGameRoles });
    await screen.findByRole("group", { name: "Overwatch" });

    fireEvent.click(box("Driller"));
    fireEvent.click(box(m.roleWithMode("Tank", "Ranked")));
    save();

    expect((await screen.findByRole("alert")).textContent).toBe(m.removedRole);
    // Until the list has loaded again, Save cannot send the removed game role once more.
    const saveButton = screen.getByRole("button", { name: m.save });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    answerReload(withoutTank);
    // Focus moves to Save in an effect after the reloaded list renders, so it is the last thing to wait for.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: m.save }),
      ),
    );
    expect(
      screen.queryByRole("checkbox", {
        name: m.roleWithMode("Tank", "Ranked"),
      }),
    ).toBeNull();
    expect(getPreferredGameRoles).toHaveBeenCalledTimes(2);
    // Driller was never saved, so its tick can only come from what the member ticked before the reload.
    expect(box("Driller").checked).toBe(true);
    expect(box("Scout").checked).toBe(true);

    save();

    await screen.findByText(m.saved);
    expect(replacePreferredGameRoles).toHaveBeenLastCalledWith([
      "scout",
      "driller",
    ]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not show the last save's message again after a failed reload is retried", async () => {
    const getPreferredGameRoles = vi
      .fn()
      .mockResolvedValueOnce(choices)
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValueOnce(choices);
    renderSection({
      getPreferredGameRoles,
      replacePreferredGameRoles: vi.fn(() =>
        Promise.reject(new ApiError(400, "invalid_game_role")),
      ),
    });
    await screen.findByRole("group", { name: "Overwatch" });

    save();
    expect(await screen.findByText(en.errors.service_unavailable)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));

    await screen.findByRole("group", { name: "Overwatch" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: m.save }),
    );
  });

  it("shows a failed load and loads again on Try again", async () => {
    const getPreferredGameRoles = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValueOnce(choices);
    renderSection({ getPreferredGameRoles });

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));

    expect(
      await screen.findByRole("group", { name: "Overwatch" }),
    ).toBeTruthy();
  });

  it("shows a failed save and sends the same choice again on Try again", async () => {
    const replacePreferredGameRoles = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValueOnce({ gameRoleIds: ["scout"], games: [] });
    renderSection({ replacePreferredGameRoles });
    await screen.findByRole("group", { name: "Overwatch" });

    save();

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));

    await screen.findByText(m.saved);
    expect(replacePreferredGameRoles).toHaveBeenNthCalledWith(2, ["scout"]);
  });
});
