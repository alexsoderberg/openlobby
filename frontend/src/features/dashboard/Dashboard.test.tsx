import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  ApiProvider,
  type ApiClient,
  type GroupSummary,
  type Lobby,
} from "../../api";
import {
  formatDate,
  formatDateTimeRange,
  formatTime,
  formatWeekdayShort,
} from "../../i18n";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import type { GroupsState } from "../groups";
import { Dashboard } from "./Dashboard";

const t = en.dashboard;
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute);
// Wednesday 4 November 2026, 18:18. The week runs Monday 2 to Sunday 8 November.
const NOW = at(4, 18, 18);

const crew: GroupSummary = { id: "g1", name: "Friday crew" };
const ranked: GroupSummary = { id: "g2", name: "Ranked grind" };

const lobby = (
  id: string,
  gameName: string,
  start: Date,
  end: Date,
  overrides: Partial<Lobby> = {},
): Lobby => ({
  id,
  gameName,
  gameGenre: null,
  maxPlayers: 5,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
  createdByUserId: "u1",
  playerCount: 3,
  joinedByMe: false,
  ...overrides,
});

function renderDashboard(
  lobbiesOf: Record<string, Lobby[] | Error>,
  groups: GroupSummary[] = [crew, ranked],
  overrides: Partial<ApiClient> = {},
) {
  const state: GroupsState = { status: "loaded", groups };
  const client = fakeApiClient({
    listUpcomingLobbies: vi.fn((groupId: string) => {
      const result = lobbiesOf[groupId] ?? [];
      return result instanceof Error
        ? Promise.reject(result)
        : Promise.resolve(result);
    }),
    ...overrides,
  });
  const onRetryGroups = vi.fn();
  const onUnauthenticated = vi.fn();
  render(
    <ApiProvider client={client}>
      <Dashboard
        groups={state}
        onRetryGroups={onRetryGroups}
        onUnauthenticated={onUnauthenticated}
      />
    </ApiProvider>,
  );
  return { client, onRetryGroups, onUnauthenticated };
}

/** The Next up band, once the lobbies have loaded. */
async function nextUpCard() {
  const section = await screen.findByRole("region", {
    name: t.nextUpHeading,
  });
  return within(section);
}

/** A day of the running order, found by its weekday and date heading. */
function column(day: Date) {
  return within(
    screen.getByRole("group", {
      name: new RegExp(`${formatWeekdayShort(day)} ${formatDate(day)}`),
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe("Next up", () => {
  it("shows the lobby that starts first across groups with game, group, time, countdown and spots", async () => {
    renderDashboard({
      g1: [lobby("l2", "Counter-Strike 2", at(6, 21), at(6, 23))],
      g2: [lobby("l1", "Overwatch 2", at(4, 20), at(4, 22))],
    });

    const card = await nextUpCard();
    expect(card.getByRole("link", { name: "Overwatch 2" })).toBeTruthy();
    expect(card.getByText(/Ranked grind/)).toBeTruthy();
    expect(
      card.getByText(new RegExp(formatWeekdayShort(at(4, 0)))),
    ).toBeTruthy();
    expect(card.getByText(t.nextUpEyebrow("in 1 h 42 min"))).toBeTruthy();
    expect(card.getByText("3/5 players")).toBeTruthy();
    expect(card.queryByText("Counter-Strike 2")).toBeNull();
  });

  it("shows players without a max as a plain count", async () => {
    renderDashboard({
      g1: [lobby("l1", "Catan", at(4, 20), at(4, 22), { maxPlayers: null })],
    });

    expect((await nextUpCard()).getByText("3 players")).toBeTruthy();
  });

  it("shows Running for a lobby that has started and not ended, and counts it as next", async () => {
    renderDashboard({
      g1: [lobby("l1", "Catan", at(4, 17), at(4, 22))],
      g2: [lobby("l2", "Overwatch 2", at(4, 20), at(4, 22))],
    });

    const card = await nextUpCard();
    expect(card.getByText(t.nextUpEyebrow(t.running))).toBeTruthy();
    expect(card.getByRole("link", { name: "Catan" })).toBeTruthy();
  });

  it("changes from Running to Ended when the lobby ends while the page is open", async () => {
    // Only here the interval is faked: waitFor polls with setInterval and would hang elsewhere.
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
    renderDashboard({ g1: [lobby("l1", "Catan", at(4, 17), at(4, 19))] });
    const card = await nextUpCard();
    expect(card.getByText(t.nextUpEyebrow(t.running))).toBeTruthy();

    act(() => vi.setSystemTime(at(4, 19, 1)));
    act(() => vi.advanceTimersByTime(15_000));

    expect(card.getByText(t.nextUpEyebrow(t.ended))).toBeTruthy();
    expect(card.getByRole("link", { name: "Catan" })).toBeTruthy();
  });

  it("says Nothing booked when no group has a lobby", async () => {
    renderDashboard({});

    expect((await nextUpCard()).getByText(t.nothingBooked)).toBeTruthy();
  });

  it("is the first band on the page, read before This week, with no side column", async () => {
    renderDashboard({});

    const nextUp = await screen.findByRole("region", { name: t.nextUpHeading });
    const thisWeek = screen.getByRole("region", { name: t.thisWeekHeading });
    expect(nextUp.compareDocumentPosition(thisWeek)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(document.querySelector(".side-layout, .side-column")).toBeNull();
  });

  it("shows the start time and the date with the time range", async () => {
    renderDashboard({
      g1: [lobby("l1", "Overwatch 2", at(4, 20), at(4, 22))],
    });

    const card = await nextUpCard();
    expect(card.getByText(formatTime(at(4, 20)))).toBeTruthy();
    expect(
      // Keep the node text as is: en-US ranges hold thin spaces, which the default normalizer collapses in the node text but not in the matcher.
      card.getByText(formatDateTimeRange(at(4, 20), at(4, 22)), {
        normalizer: (text) => text,
      }),
    ).toBeTruthy();
  });
});

describe("no game pictures on Home", () => {
  it("shows no logo, monogram or cover on Next up or in the running order", async () => {
    renderDashboard({
      g1: [
        lobby("l1", "Overwatch 2", at(4, 20), at(4, 22), {
          gameId: "game1",
          gameGenre: "shooter",
          gameLogoVersion: "c".repeat(64),
          gameCoverVersion: "d".repeat(64),
        }),
      ],
    });
    await nextUpCard();

    expect(document.querySelector('[data-slot="game-logo"], img')).toBeNull();
    expect(screen.queryByText(en.genre.shooter)).toBeNull();
  });
});

describe("label and role slots", () => {
  const overwatch = lobby("l1", "Overwatch 2", at(4, 20), at(4, 22), {
    modeName: "Competitive",
    flexCount: 1,
    roleSlots: [
      {
        gameRoleId: "r1",
        name: "Tank",
        slots: 1,
        playerCount: 0,
        roleIcon: "shield",
      },
    ],
  });

  it("shows the label and role slots on Next up", async () => {
    renderDashboard({ g1: [overwatch], g2: [] });

    const card = await nextUpCard();
    expect(
      card.getByRole("link", { name: "Overwatch 2 › Competitive" }),
    ).toBeTruthy();
    expect(
      card
        .getByText("Tank 0/1")
        .closest("li")!
        .querySelector('[data-icon="shield"]'),
    ).not.toBeNull();
    expect(card.getByText("Flex 1").querySelector("svg")).toBeNull();
  });
});

describe("This week", () => {
  it("places each lobby in the row of its day with label, time, group and spots, as a link to its lobby", async () => {
    renderDashboard({
      g1: [lobby("l1", "Counter-Strike 2", at(6, 21), at(6, 23))],
      g2: [lobby("l2", "Overwatch 2", at(4, 20), at(4, 22))],
    });
    await nextUpCard();

    const wednesday = column(at(4, 0));
    const link = wednesday.getByRole("link", { name: /^Overwatch 2, / });
    expect(link.getAttribute("href")).toBe("/groups/g2/lobbies/l2");
    const block = link.closest("li")!;
    expect(block.textContent).toContain("Ranked grind");
    expect(block.textContent).toContain("3/5");
    expect(link.getAttribute("aria-label")).toContain("3/5 players");
    expect(block.textContent).toContain(
      en.runningOrder.times(formatTime(at(4, 20)), formatTime(at(4, 22))),
    );
    expect(
      column(at(6, 0)).getByRole("link", { name: /^Counter-Strike 2, / }),
    ).toBeTruthy();
    expect(column(at(5, 0)).queryByRole("link")).toBeNull();
  });

  it("shows both parts of a lobby that crosses midnight", async () => {
    renderDashboard({
      g1: [lobby("l1", "Counter-Strike 2", at(6, 21), at(7, 1))],
    });
    await nextUpCard();

    expect(
      column(at(6, 0)).getByRole("link", { name: /^Counter-Strike 2, / }),
    ).toBeTruthy();
    expect(
      column(at(7, 0)).getByRole("link", { name: /^Counter-Strike 2, / }),
    ).toBeTruthy();
  });

  it("shows the rest of a lobby that started before Monday on Monday", async () => {
    renderDashboard({
      g1: [lobby("l1", "Catan", new Date(2026, 10, 1, 22), at(4, 20))],
    });
    await nextUpCard();

    expect(
      column(at(2, 0)).getByRole("link", { name: /^Catan, / }),
    ).toBeTruthy();
  });

  it("leaves out lobbies of other weeks and says Nothing booked on every day, with no legend", async () => {
    renderDashboard({
      g1: [lobby("l1", "Catan", at(10, 20), at(10, 22))],
    });
    await nextUpCard();

    expect(column(at(4, 0)).queryByRole("link")).toBeNull();
    expect(screen.getAllByText(en.runningOrder.nothingBooked)).toHaveLength(7);
    expect(screen.queryByRole("list", { name: t.legendLabel })).toBeNull();
  });

  it("lists the groups with a block this week in the legend, and You are in", async () => {
    renderDashboard({
      g1: [lobby("l1", "Catan", at(5, 20), at(5, 22))],
      g2: [lobby("l2", "Chess", at(10, 20), at(10, 22))],
    });
    await nextUpCard();

    const legend = within(screen.getByRole("list", { name: t.legendLabel }));
    expect(
      legend.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([crew.name, t.legendYou]);
  });

  it("has no view toggle and cannot create a lobby", async () => {
    renderDashboard({ g1: [lobby("l1", "Catan", at(5, 20), at(5, 22))] });
    const card = await nextUpCard();

    const buttons = screen.getAllByRole("button");
    expect(buttons).toEqual(card.getAllByRole("button"));
    expect(screen.queryByRole("button", { name: /create lobby/i })).toBeNull();
  });
});

describe("empty and error states", () => {
  it("sends a user without groups to the Groups page, and shows no band or week", () => {
    renderDashboard({}, []);

    expect(screen.getByText(t.noGroups)).toBeTruthy();
    expect(screen.getByText(t.noGroupsHint)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: t.noGroupsLink }).getAttribute("href"),
    ).toBe("/groups");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("shows one page-level error with no partial data when one group fails, and recovers on retry", async () => {
    const listUpcomingLobbies = vi
      .fn<ApiClient["listUpcomingLobbies"]>()
      .mockResolvedValueOnce([lobby("l1", "Catan", at(4, 20), at(4, 22))])
      .mockRejectedValueOnce(new ApiError(503, "service_unavailable"))
      .mockResolvedValue([]);
    renderDashboard({}, [crew, ranked], { listUpcomingLobbies });

    expect((await screen.findByRole("alert")).textContent).toBe(
      en.errors.service_unavailable,
    );
    expect(screen.queryByRole("link", { name: /Catan/ })).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));

    expect((await nextUpCard()).getByText(t.nothingBooked)).toBeTruthy();
    expect(listUpcomingLobbies).toHaveBeenCalledTimes(4);
  });

  it("hands an expired session over", async () => {
    const { onUnauthenticated } = renderDashboard(
      { g1: new ApiError(401, "unauthenticated") },
      [crew],
    );

    await waitFor(() => expect(onUnauthenticated).toHaveBeenCalledOnce());
  });

  it("shows the group error with a retry that reloads the groups", () => {
    const onRetryGroups = vi.fn();
    render(
      <ApiProvider client={fakeApiClient()}>
        <Dashboard
          groups={{ status: "error", code: "service_unavailable" }}
          onRetryGroups={onRetryGroups}
          onUnauthenticated={vi.fn()}
        />
      </ApiProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: en.tryAgain }));

    expect(onRetryGroups).toHaveBeenCalledOnce();
  });
});

describe("Next up join and leave", () => {
  const upcoming = (overrides: Partial<Lobby> = {}) => ({
    g1: [lobby("l1", "Overwatch 2", at(4, 20), at(4, 22), overrides)],
  });

  it("joins from the card and loads the lobbies again", async () => {
    const lobbiesOf = upcoming();
    const { client } = renderDashboard(lobbiesOf, [crew, ranked], {
      joinLobby: vi.fn(() => {
        lobbiesOf.g1 = upcoming({ joinedByMe: true }).g1;
        return Promise.resolve();
      }),
    });

    const card = await nextUpCard();
    fireEvent.click(card.getByRole("button", { name: en.lobbyJoin }));

    await waitFor(() =>
      expect(client.joinLobby).toHaveBeenCalledWith("g1", "l1"),
    );
    await waitFor(() =>
      expect(client.listUpcomingLobbies).toHaveBeenCalledTimes(4),
    );
    expect(
      await card.findByRole("button", { name: en.lobbyLeave }),
    ).toBeTruthy();
  });

  it("never offers join again while the lobbies reload after joining", async () => {
    let reloaded: (lobbies: Lobby[]) => void = () => {};
    const { client } = renderDashboard(upcoming(), [crew, ranked], {
      joinLobby: vi.fn(() => Promise.resolve()),
    });
    const card = await nextUpCard();
    vi.mocked(client.listUpcomingLobbies).mockImplementation(
      () => new Promise((resolve) => (reloaded = resolve)),
    );

    fireEvent.click(card.getByRole("button", { name: en.lobbyJoin }));

    expect(
      await card.findByRole("button", { name: en.lobbyLeave }),
    ).toBeTruthy();
    expect(card.queryByRole("button", { name: en.lobbyJoin })).toBeNull();
    await act(async () => reloaded(upcoming({ joinedByMe: true }).g1));
    expect(card.getByRole("button", { name: en.lobbyLeave })).toBeTruthy();
  });

  it("offers leave on a lobby I joined, also while it is running", async () => {
    const { client } = renderDashboard(
      upcoming({ joinedByMe: true, startsAt: at(4, 17).toISOString() }),
    );

    const card = await nextUpCard();
    expect(card.getByText(t.nextUpEyebrow(t.running))).toBeTruthy();
    fireEvent.click(card.getByRole("button", { name: en.lobbyLeave }));

    await waitFor(() =>
      expect(client.leaveLobby).toHaveBeenCalledWith("g1", "l1"),
    );
  });

  it("shows the full message on the card", async () => {
    renderDashboard(upcoming(), [crew, ranked], {
      joinLobby: vi.fn(() => Promise.reject(new ApiError(409, "lobby_full"))),
    });

    const card = await nextUpCard();
    fireEvent.click(card.getByRole("button", { name: en.lobbyJoin }));

    expect((await card.findByRole("alert")).textContent).toBe(
      en.errors.lobby_full,
    );
  });
});
