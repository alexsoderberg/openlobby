import { describe, expect, it } from "vitest";
import { daySegments, nowPosition, openingMinute } from "./runningOrderLayout";

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute);
const span = (id: string, start: Date, end: Date) => ({
  id,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
});
// Wednesday 4 November 2026. The week runs Monday 2 to Sunday 8 November.
const WEDNESDAY = at(4, 0);
const MONDAY = at(2, 0);

describe("daySegments", () => {
  it("places a lobby at its start and end minute", () => {
    const { segments, lanes } = daySegments(WEDNESDAY, [
      span("a", at(4, 20), at(4, 22, 30)),
    ]);
    expect(lanes).toBe(1);
    expect(segments).toMatchObject([
      {
        startMinute: 1200,
        endMinute: 1350,
        lane: 0,
        continuesBefore: false,
        continuesAfter: false,
      },
    ]);
  });

  it("splits a lobby at midnight: to 24:00 on its start day, from 00:00 on the next", () => {
    const overnight = span("night", at(4, 22), at(5, 2));
    expect(daySegments(WEDNESDAY, [overnight]).segments[0]).toMatchObject({
      startMinute: 1320,
      endMinute: 1440,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(daySegments(at(5, 0), [overnight]).segments[0]).toMatchObject({
      startMinute: 0,
      endMinute: 120,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it("starts a lobby that began before Monday at 00:00 on Monday", () => {
    const carried = span("carried", new Date(2026, 10, 1, 22), at(2, 3));
    expect(daySegments(MONDAY, [carried]).segments[0]).toMatchObject({
      startMinute: 0,
      endMinute: 180,
      continuesBefore: true,
    });
  });

  it("puts overlapping lobbies in lanes, each in the lowest lane free at its start", () => {
    const { segments, lanes } = daySegments(WEDNESDAY, [
      span("a", at(4, 18), at(4, 21)),
      span("b", at(4, 19), at(4, 20)),
      span("c", at(4, 20), at(4, 22)),
      span("d", at(4, 20, 30), at(4, 23)),
    ]);
    expect(segments.map(({ lobby, lane }) => [lobby.id, lane])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 1],
      ["d", 2],
    ]);
    expect(lanes).toBe(3);
  });

  it("lists the segments in start order, whatever order they came in", () => {
    const { segments } = daySegments(WEDNESDAY, [
      span("late", at(4, 21), at(4, 22)),
      span("early", at(4, 9), at(4, 10)),
    ]);
    expect(segments.map(({ lobby }) => lobby.id)).toEqual(["early", "late"]);
  });

  it("has one lane on a day with no lobby", () => {
    expect(daySegments(WEDNESDAY, [])).toEqual({ segments: [], lanes: 1 });
  });
});

describe("openingMinute", () => {
  const now = at(4, 18, 18);
  const PHONE = 6 * 60;
  const WIDE = 16 * 60;

  it("goes to the full hour before the first lobby that has not ended", () => {
    const lobbies = [
      span("ended", at(4, 9), at(4, 10)),
      span("later", at(6, 9, 30), at(6, 11)),
      span("next", at(4, 20, 45), at(4, 22)),
    ];
    expect(openingMinute(lobbies, MONDAY, now, PHONE)).toBe(20 * 60);
  });

  it("counts a running lobby", () => {
    const running = span("running", at(4, 17, 30), at(4, 19));
    expect(openingMinute([running], MONDAY, now, PHONE)).toBe(17 * 60);
  });

  it("goes to the hour of now when every lobby has ended or there is none", () => {
    expect(openingMinute([], MONDAY, now, PHONE)).toBe(18 * 60);
    expect(
      openingMinute([span("ended", at(4, 9), at(4, 10))], MONDAY, now, PHONE),
    ).toBe(18 * 60);
  });

  it("goes to 00:00 for a lobby that began before the first day", () => {
    const carried = span("carried", new Date(2026, 10, 1, 22), at(4, 20));
    expect(openingMinute([carried], MONDAY, now, PHONE)).toBe(0);
  });

  describe("on a wide screen, a window that holds the lobbies", () => {
    it("opens at 08:00 for an evening week, so 16 hours reach midnight", () => {
      const lobbies = [
        span("wed", at(4, 20, 30), at(4, 22)),
        span("sat", at(7, 13), at(7, 16)),
      ];
      expect(openingMinute(lobbies, MONDAY, now, WIDE)).toBe(8 * 60);
    });

    it("opens earlier for a lobby of the morning, on any day", () => {
      const lobbies = [
        span("wed", at(4, 20), at(4, 22)),
        span("early", at(6, 6, 30), at(6, 9)),
      ];
      expect(openingMinute(lobbies, MONDAY, now, WIDE)).toBe(6 * 60);
    });

    it("leaves out lobbies that have ended", () => {
      const lobbies = [
        span("ended", at(3, 5), at(3, 6)),
        span("wed", at(4, 20), at(4, 22)),
      ];
      expect(openingMinute(lobbies, MONDAY, now, WIDE)).toBe(8 * 60);
    });

    it("opens at the hour of now when no lobby is open, at most 08:00", () => {
      const night = at(4, 3);
      expect(openingMinute([], MONDAY, night, WIDE)).toBe(180);
      expect(openingMinute([], MONDAY, now, WIDE)).toBe(8 * 60);
    });

    it("counts from now when every lobby has ended", () => {
      const ended = [span("ended", at(4, 1), at(4, 2))];
      expect(openingMinute(ended, MONDAY, at(4, 3, 30), WIDE)).toBe(180);
    });

    it("never opens so late that the window passes midnight", () => {
      expect(openingMinute([], MONDAY, now, 20 * 60)).toBe(4 * 60);
    });

    it("opens at 00:00 when the whole day is visible", () => {
      const evening = [span("wed", at(4, 20), at(4, 22))];
      expect(openingMinute(evening, MONDAY, now, 24 * 60)).toBe(0);
    });
  });
});

describe("nowPosition", () => {
  it("is the minutes since midnight over the day", () => {
    expect(nowPosition(at(4, 0))).toBe(0);
    expect(nowPosition(at(4, 12))).toBe(0.5);
    expect(nowPosition(at(4, 18, 18))).toBeCloseTo(1098 / 1440);
  });
});
