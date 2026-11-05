import { describe, expect, it } from "vitest";
import { nextUpOf, thisWeekOf, type DashboardLobby } from "./dashboardLobby";

const at = (day: number, hour: number) => new Date(2026, 10, day, hour);
const lobby = (id: string, start: Date, end: Date): DashboardLobby => ({
  id,
  gameName: id,
  maxPlayers: 5,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
  createdByUserId: "u1",
  playerCount: 1,
  joinedByMe: false,
  groupId: "g1",
  groupName: "Crew",
});
// Wednesday 4 November 2026, 12:00. The week runs Monday 2 to Sunday 8 November.
const NOW = at(4, 12).getTime();

describe("nextUpOf", () => {
  it("is nothing without lobbies", () => {
    expect(nextUpOf([], NOW)).toBeUndefined();
  });

  it("picks the lobby that starts first across groups", () => {
    const later = lobby("later", at(5, 20), at(5, 22));
    const sooner = lobby("sooner", at(4, 20), at(4, 22));
    expect(nextUpOf([later, sooner], NOW)).toBe(sooner);
  });

  it("counts a running lobby, which started before the others", () => {
    const running = lobby("running", at(4, 11), at(4, 14));
    const upcoming = lobby("upcoming", at(4, 20), at(4, 22));
    expect(nextUpOf([upcoming, running], NOW)).toBe(running);
  });

  it("skips a lobby that has ended", () => {
    const ended = lobby("ended", at(4, 9), at(4, 11));
    const upcoming = lobby("upcoming", at(4, 20), at(4, 22));
    expect(nextUpOf([ended, upcoming], NOW)).toBe(upcoming);
  });

  it("breaks a tie on start time by id", () => {
    const b = lobby("b", at(4, 20), at(4, 22));
    const a = lobby("a", at(4, 20), at(4, 22));
    expect(nextUpOf([b, a], NOW)).toBe(a);
  });
});

describe("thisWeekOf", () => {
  it("lists lobbies on their start day in start order, including the next up one", () => {
    const wednesdayLate = lobby("late", at(4, 22), at(5, 1));
    const wednesdayEarly = lobby("early", at(4, 18), at(4, 20));
    const saturday = lobby("sat", at(7, 18), at(7, 20));
    const week = thisWeekOf([saturday, wednesdayLate, wednesdayEarly], NOW);
    expect(week[2].items).toEqual([wednesdayEarly, wednesdayLate]);
    expect(week[5].items).toEqual([saturday]);
  });

  it("shows a running lobby that started before Monday on Monday", () => {
    const carried = lobby("carried", new Date(2026, 10, 1, 22), at(4, 15));
    expect(thisWeekOf([carried], NOW)[0].items).toEqual([carried]);
  });

  it("leaves out lobbies that ended and lobbies of other weeks", () => {
    const ended = lobby("ended", at(3, 18), at(3, 20));
    const nextWeek = lobby("next", at(10, 18), at(10, 20));
    const week = thisWeekOf([ended, nextWeek], NOW);
    expect(week.flatMap((day) => day.items)).toEqual([]);
  });
});
