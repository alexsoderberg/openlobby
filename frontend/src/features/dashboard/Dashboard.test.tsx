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
import { formatDayOfMonth, formatWeekdayShort } from "../../i18n";
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

/** The wide-screen column of a day. Both layouts are in the document; CSS shows one. */
function column(day: Date) {
  const title = screen.getByRole("heading", {
    name: `${formatWeekdayShort(day)} ${formatDayOfMonth(day)}`,
  });
  return within(title.closest("li")!);
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
  it("lists each lobby in the column of its start day, with the next up lobby too", async () => {
    renderDashboard({
      g1: [lobby("l1", "Counter-Strike 2", at(6, 21), at(7, 1))],
      g2: [lobby("l2", "Overwatch 2", at(4, 20), at(4, 22))],
    });
    await nextUpCard();

    const wednesday = column(at(4, 0));
    expect(wednesday.getByRole("link", { name: "Overwatch 2" })).toBeTruthy();
    expect(wednesday.getByText("Ranked grind")).toBeTruthy();
    expect(wednesday.getByText("3/5 players")).toBeTruthy();
    const friday = column(at(6, 0));
    expect(friday.getByRole("link", { name: "Counter-Strike 2" })).toBeTruthy();
    expect(
      friday.getByText(new RegExp(`\\(${en.lobbyEndsNextDay}\\)`)),
    ).toBeTruthy();
    expect(column(at(5, 0)).getByText(t.nothingBooked)).toBeTruthy();
  });

  it("shows a lobby that started before Monday and still runs on Monday", async () => {
    renderDashboard({
      g1: [lobby("l1", "Catan", new Date(2026, 10, 1, 22), at(4, 20))],
    });
    await nextUpCard();

    expect(column(at(2, 0)).getByRole("link", { name: "Catan" })).toBeTruthy();
  });

  it("leaves out lobbies of other weeks", async () => {
    renderDashboard({
      g1: [lobby("l1", "Catan", at(10, 20), at(10, 22))],
    });
    await nextUpCard();

    expect(column(at(4, 0)).queryByRole("link")).toBeNull();
    expect(screen.getAllByText(t.nothingBooked).length).toBeGreaterThan(7);
  });

  it("marks days with lobbies on the Day pills, selects today and lists the chosen day in the Agenda", async () => {
    renderDashboard({
      g1: [lobby("l1", "Counter-Strike 2", at(6, 21), at(6, 23))],
      g2: [lobby("l2", "Overwatch 2", at(4, 20), at(4, 22))],
    });
    await nextUpCard();

    const pills = within(screen.getByRole("group", { name: t.dayPillsLabel }));
    const pressed = pills
      .getAllByRole("button")
      .filter((pill) => pill.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toContain(formatDayOfMonth(at(4, 0)));
    expect(pills.getAllByText(t.dayHasLobbies)).toHaveLength(2);

    fireEvent.click(
      pills.getByRole("button", {
        name: new RegExp(formatWeekdayShort(at(6, 0))),
      }),
    );

    const agenda = within(
      document.querySelector<HTMLElement>(".agenda") as HTMLElement,
    );
    expect(agenda.getByRole("link", { name: "Counter-Strike 2" })).toBeTruthy();
    fireEvent.click(
      pills.getByRole("button", {
        name: new RegExp(formatWeekdayShort(at(7, 0))),
      }),
    );
    expect(agenda.getByText(t.nothingBooked)).toBeTruthy();
  });
});

describe("empty and error states", () => {
  it("tells a user without groups to use the plus, and shows no card or week", () => {
    renderDashboard({}, []);

    expect(screen.getByText(t.noGroups)).toBeTruthy();
    expect(screen.getByText(t.noGroupsHint)).toBeTruthy();
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
