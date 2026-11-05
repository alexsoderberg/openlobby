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
  formatDayOfMonth,
  formatTimeRange,
  formatWeekdayShort,
} from "../../i18n";
import { en } from "../../i18n/messages/en";
import { fakeApiClient } from "../../test/fakeApiClient";
import { dayColumns, selectedColumns } from "../../test/weekGrid";
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
  maxPlayers: 5,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
  createdByUserId: "u1",
  playerCount: 3,
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

/** The Next up card, once the lobbies have loaded. */
async function nextUpCard() {
  const section = await screen.findByRole("region", {
    name: t.nextUpHeading,
  });
  return within(section);
}

/** The column of a day, found by its place in the week (Monday first). */
function column(day: Date) {
  return within(dayColumns()[(day.getDay() + 6) % 7]);
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
    expect(card.getByText("in 1 h 42 min")).toBeTruthy();
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
    expect(card.getByText(t.running)).toBeTruthy();
    expect(card.getByRole("link", { name: "Catan" })).toBeTruthy();
  });

  it("has no join or leave button", async () => {
    renderDashboard({ g1: [lobby("l1", "Catan", at(4, 20), at(4, 22))] });

    await nextUpCard();
    expect(screen.queryByRole("button", { name: /join|leave/i })).toBeNull();
  });

  it("changes from Running to Ended when the lobby ends while the page is open", async () => {
    // Only here the interval is faked: waitFor polls with setInterval and would hang elsewhere.
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(NOW);
    renderDashboard({ g1: [lobby("l1", "Catan", at(4, 17), at(4, 19))] });
    const card = await nextUpCard();
    expect(card.getByText(t.running)).toBeTruthy();

    act(() => vi.setSystemTime(at(4, 19, 1)));
    act(() => vi.advanceTimersByTime(15_000));

    expect(card.getByText(t.ended)).toBeTruthy();
    expect(card.getByRole("link", { name: "Catan" })).toBeTruthy();
  });

  it("says Nothing booked when no group has a lobby", async () => {
    renderDashboard({});

    expect((await nextUpCard()).getByText(t.nothingBooked)).toBeTruthy();
  });
});

describe("This week", () => {
  it("places each lobby in the column of its day with game, time, group and spots, as a link to its lobby", async () => {
    renderDashboard({
      g1: [lobby("l1", "Counter-Strike 2", at(6, 21), at(6, 23))],
      g2: [lobby("l2", "Overwatch 2", at(4, 20), at(4, 22))],
    });
    await nextUpCard();

    const wednesday = column(at(4, 0));
    const link = wednesday.getByRole("link", { name: "Overwatch 2" });
    expect(link.getAttribute("href")).toBe("/groups/g2/lobbies/l2");
    const block = link.closest("li")!;
    expect(block.textContent).toContain("Ranked grind");
    expect(block.textContent).toContain("3/5 players");
    expect(block.textContent).toContain(formatTimeRange(at(4, 20), at(4, 22)));
    expect(
      block.style.getPropertyValue("--start") +
        "/" +
        block.style.getPropertyValue("--span"),
    ).toBe("1200/120");
    expect(
      column(at(6, 0)).getByRole("link", { name: "Counter-Strike 2" }),
    ).toBeTruthy();
    expect(column(at(5, 0)).queryByRole("link")).toBeNull();
  });

  it("shows both parts of a lobby that crosses midnight", async () => {
    renderDashboard({
      g1: [lobby("l1", "Counter-Strike 2", at(6, 21), at(7, 1))],
    });
    await nextUpCard();

    expect(
      column(at(6, 0)).getByRole("link", { name: "Counter-Strike 2" }),
    ).toBeTruthy();
    expect(
      column(at(7, 0)).getByRole("link", { name: "Counter-Strike 2" }),
    ).toBeTruthy();
  });

  it("shows the rest of a lobby that started before Monday on Monday", async () => {
    renderDashboard({
      g1: [lobby("l1", "Catan", new Date(2026, 10, 1, 22), at(4, 20))],
    });
    await nextUpCard();

    expect(column(at(2, 0)).getByRole("link", { name: "Catan" })).toBeTruthy();
  });

  it("leaves out lobbies of other weeks and says Nothing booked on every day", async () => {
    renderDashboard({
      g1: [lobby("l1", "Catan", at(10, 20), at(10, 22))],
    });
    await nextUpCard();

    expect(column(at(4, 0)).queryByRole("link")).toBeNull();
    expect(screen.getAllByText(en.calendarNothingBooked)).toHaveLength(7);
  });

  it("says Nothing booked only on the days without lobbies", async () => {
    renderDashboard({ g1: [lobby("l1", "Catan", at(5, 20), at(5, 22))] });
    await nextUpCard();

    const grid = within(
      screen.getByRole("region", { name: en.calendarGridLabel }),
    );
    expect(grid.getAllByRole("heading", { level: 3 })).toHaveLength(7);
    expect(column(at(5, 0)).queryByText(en.calendarNothingBooked)).toBeNull();
    expect(column(at(6, 0)).getByText(en.calendarNothingBooked)).toBeTruthy();
  });

  describe("opening scroll", () => {
    const scrollTop = () =>
      screen.getByRole("region", { name: en.calendarGridLabel }).scrollTop;
    const earlyThursday = {
      g1: [
        lobby("l1", "Catan", at(5, 9), at(5, 10)),
        lobby("l2", "Chess", at(4, 20), at(4, 22)),
      ],
    };

    beforeEach(() => {
      // jsdom does no layout: give the grid a height of 2400 px, so a minute is 5/3 px.
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
        2400,
      );
    });
    afterEach(() => vi.restoreAllMocks());

    it("goes to the earliest lobby of the week on wide screens", async () => {
      renderDashboard(earlyThursday);
      await nextUpCard();

      expect(scrollTop()).toBe(9 * 100);
    });

    it("goes to the selected day on phones, not to an earlier lobby on another day", async () => {
      vi.spyOn(window, "matchMedia").mockReturnValue({
        matches: true,
      } as MediaQueryList);
      renderDashboard(earlyThursday);
      await nextUpCard();

      expect(scrollTop()).toBe(16 * 100);
    });
  });

  it("cannot create a lobby from the grid", async () => {
    renderDashboard({ g1: [lobby("l1", "Catan", at(5, 20), at(5, 22))] });
    await nextUpCard();

    expect(screen.queryByRole("button", { name: /create lobby/i })).toBeNull();
  });

  it("marks days with lobbies on the Day pills, selects today and shows the chosen day on phones", async () => {
    renderDashboard({
      g1: [lobby("l1", "Counter-Strike 2", at(6, 21), at(6, 23))],
      g2: [lobby("l2", "Overwatch 2", at(4, 20), at(4, 22))],
    });
    await nextUpCard();

    const pills = within(
      screen.getByRole("group", { name: en.calendarDayPillsLabel }),
    );
    const pressed = pills
      .getAllByRole("button")
      .filter((pill) => pill.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toContain(formatDayOfMonth(at(4, 0)));
    expect(pills.getAllByText(en.calendarDayHasLobbies)).toHaveLength(2);
    expect(selectedColumns()).toEqual([dayColumns()[2]]);

    fireEvent.click(
      pills.getByRole("button", {
        name: new RegExp(formatWeekdayShort(at(6, 0))),
      }),
    );

    expect(selectedColumns()).toEqual([dayColumns()[4]]);
  });
});

describe("empty and error states", () => {
  it("sends a user without groups to the Groups page, and shows no card or week", () => {
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
    expect(screen.queryByRole("link", { name: "Catan" })).toBeNull();
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

describe("group strip", () => {
  it("links each group icon to its group by name", async () => {
    renderDashboard({});
    await nextUpCard();

    const strip = within(
      screen.getByRole("navigation", { name: t.groupStripLabel }),
    );
    expect(
      strip.getByRole("link", { name: "Friday crew" }).getAttribute("href"),
    ).toBe("/groups/g1");
  });
});
