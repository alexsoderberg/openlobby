import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatWeekday } from "../../i18n";
import { en } from "../../i18n/messages/en";
import { dayColumns } from "../../test/weekGrid";
import type { DashboardLobby } from "./dashboardLobby";
import { ThisWeek } from "./ThisWeek";

const t = en.dashboard;
const at = (day: number, hour: number) => new Date(2026, 10, day, hour);
// Wednesday 4 November 2026; the week runs Monday 2 to Sunday 8.
const NOW = at(4, 18).getTime();

const lobby = (
  id: string,
  gameName: string,
  start: Date,
  end: Date,
): DashboardLobby => ({
  id,
  gameName,
  gameGenre: null,
  maxPlayers: 5,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
  createdByUserId: "u1",
  playerCount: 3,
  joinedByMe: false,
  groupId: "g1",
  groupName: "Friday crew",
});

const lobbies = [
  lobby("l1", "Catan", at(1, 22), at(4, 23)), // started before Monday, still running
  lobby("l2", "Overwatch 2", at(4, 20), at(5, 1)), // crosses midnight
  lobby("l3", "Counter-Strike 2", at(6, 21), at(6, 23)),
];

const renderWeek = (items: DashboardLobby[] = lobbies) =>
  render(<ThisWeek lobbies={items} now={NOW} />);
const button = (name: string) => screen.getByRole("button", { name });

/** A storage that can fail, replacing the browser's for one test. */
function stubStorage(overrides: Partial<Storage> = {}) {
  const saved = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => void saved.set(key, value),
    ...overrides,
  });
  return saved;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  stubStorage();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("This week view toggle", () => {
  it("shows the calendar by default, with Week calendar pressed", () => {
    renderWeek();

    expect(dayColumns()).toHaveLength(7);
    expect(button(t.viewCalendar).getAttribute("aria-pressed")).toBe("true");
    expect(button(t.viewDays).getAttribute("aria-pressed")).toBe("false");
  });

  it("switches to the day list and back", () => {
    renderWeek();

    fireEvent.click(button(t.viewDays));
    expect(dayColumns()).toHaveLength(0);
    expect(button(t.viewDays).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(button(t.viewCalendar));
    expect(dayColumns()).toHaveLength(7);
  });

  it("themes each day-list row by its game genre, neutral without one", () => {
    renderWeek([
      {
        ...lobby("l1", "Overwatch 2", at(4, 20), at(4, 22)),
        gameGenre: "shooter",
      },
      lobby("l2", "Catan", at(5, 20), at(5, 22)),
    ]);
    fireEvent.click(button(t.viewDays));

    const row = (name: string) =>
      screen.getByRole("link", { name }).closest("li")!;
    expect(row("Overwatch 2").getAttribute("data-genre")).toBe("shooter");
    expect(row("Catan").getAttribute("data-genre")).toBe("neutral");
    expect(within(row("Overwatch 2")).getByText(en.genre.shooter)).toBeTruthy();
  });

  it("keeps the choice in the browser and shows it from the first render", () => {
    const saved = stubStorage();
    const { unmount } = renderWeek();
    fireEvent.click(button(t.viewDays));
    expect([...saved.values()]).toEqual(["days"]);
    unmount();

    renderWeek();
    expect(dayColumns()).toHaveLength(0);
    expect(button(t.viewDays).getAttribute("aria-pressed")).toBe("true");
  });

  it("falls back to the calendar for a saved value it does not know", () => {
    const saved = stubStorage();
    saved.set("openlobby.thisWeekView", "month");

    renderWeek();
    expect(dayColumns()).toHaveLength(7);
  });

  it("uses the default when reading fails, and still switches when saving fails", () => {
    const refused = () => {
      throw new DOMException("refused", "SecurityError");
    };
    stubStorage({ getItem: refused, setItem: refused });

    renderWeek();
    expect(dayColumns()).toHaveLength(7);
    fireEvent.click(button(t.viewDays));
    expect(dayColumns()).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Day list", () => {
  beforeEach(() => stubStorage().set("openlobby.thisWeekView", "days"));

  it("lists only days with lobbies, in order, a lobby from before Monday under Monday", () => {
    renderWeek();

    const headings = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      formatWeekday(at(2, 0)),
      formatWeekday(at(4, 0)),
      formatWeekday(at(6, 0)),
    ]);
    const monday = within(
      screen.getByRole("region", { name: formatWeekday(at(2, 0)) }),
    );
    expect(monday.getByRole("link", { name: "Catan" })).toBeTruthy();
  });

  it("shows time, group and spots, links to the lobby, and names a lobby that crosses midnight once", () => {
    renderWeek();

    const row = screen
      .getByRole("link", { name: "Overwatch 2" })
      .closest("li")!;
    expect(row.textContent).toContain("Friday crew");
    expect(row.textContent).toContain("3/5 players");
    expect(
      screen
        .getByRole("link", { name: "Counter-Strike 2" })
        .getAttribute("href"),
    ).toBe("/groups/g1/lobbies/l3");
    expect(screen.getAllByRole("link", { name: "Overwatch 2" })).toHaveLength(
      1,
    );
  });

  it("uses the label as the row link and shows role slots and flex", () => {
    renderWeek([
      {
        ...lobby("l9", "Overwatch 2", at(5, 20), at(5, 22)),
        modeName: "Competitive",
        flexCount: 1,
        roleSlots: [
          { gameRoleId: "r1", name: "Tank", slots: 1, playerCount: 0 },
        ],
      },
    ]);

    const row = screen
      .getByRole("link", { name: "Overwatch 2 › Competitive" })
      .closest("li")!;
    expect(within(row).getByText("Tank 0/1")).toBeTruthy();
    expect(within(row).getByText("Flex 1")).toBeTruthy();
  });

  it("says so when nothing is booked this week", () => {
    renderWeek([]);
    expect(screen.getByText(t.nothingBookedWeek)).toBeTruthy();
  });
});

describe("Week calendar empty", () => {
  it("shows Nothing booked on every day", () => {
    renderWeek([]);
    expect(screen.getAllByText(t.nothingBooked)).toHaveLength(7);
  });
});
