import { describe, expect, it, vi } from "vitest";
import type { Lobby } from "../../api";
import {
  calendarWeek,
  clusterOverlapping,
  isBeforeToday,
} from "./calendarWeek";

const lobby = (id: string, start: Date, end: Date): Lobby => ({
  id,
  gameName: id,
  maxPlayers: null,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
  createdByUserId: "u1",
  playerCount: 1,
});
const at = (day: number, hour: number) => new Date(2026, 10, day, hour);

describe("clusterOverlapping", () => {
  it("puts overlapping lobbies together and separates the rest", () => {
    const a = lobby("a", at(4, 18), at(4, 22));
    const b = lobby("b", at(4, 20), at(4, 23));
    const c = lobby("c", at(4, 23), at(5, 1));
    expect(clusterOverlapping([a, b, c])).toEqual([[a, b], [c]]);
  });

  it("keeps a long lobby together with all it covers", () => {
    const long = lobby("long", at(4, 10), at(4, 20));
    const x = lobby("x", at(4, 12), at(4, 13));
    const y = lobby("y", at(4, 15), at(4, 16));
    expect(clusterOverlapping([long, x, y])).toEqual([[long, x, y]]);
  });
});

describe("calendarWeek", () => {
  it("shows a lobby on its start day only, also when it ends the next day", () => {
    const overnight = lobby("night", at(4, 22), at(5, 2));
    const nextWeek = lobby("later", at(10, 12), at(10, 13));
    const week = calendarWeek(new Date(2026, 10, 2), [overnight, nextWeek]);
    expect(week.map((entry) => entry.clusters.length)).toEqual([
      0, 0, 1, 0, 0, 0, 0,
    ]);
    expect(week[2].clusters[0]).toEqual([overnight]);
  });

  it("puts a lobby that started before Monday and still runs on Monday", () => {
    const carried = lobby("carried", new Date(2026, 10, 1, 22), at(2, 3));
    const ended = lobby("ended", new Date(2026, 10, 1, 20), at(2, 0));
    const week = calendarWeek(new Date(2026, 10, 2), [ended, carried]);
    expect(week[0].clusters).toEqual([[carried]]);
  });
});

describe("isBeforeToday", () => {
  it("is true for yesterday and false for today and tomorrow", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 4, 12, 0));
    expect(isBeforeToday(new Date(2026, 10, 3))).toBe(true);
    expect(isBeforeToday(new Date(2026, 10, 4))).toBe(false);
    expect(isBeforeToday(new Date(2026, 10, 5))).toBe(false);
    vi.useRealTimers();
  });
});
