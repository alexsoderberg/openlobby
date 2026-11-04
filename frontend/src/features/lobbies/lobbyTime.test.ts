import { describe, expect, it } from "vitest";
import {
  endsNextDay,
  localClockText,
  localDateText,
  lobbyTimesFrom,
  suggestedEnd,
} from "./lobbyTime";

// Local times throughout, so the tests hold in any time zone.
const now = new Date(2026, 10, 4, 12, 0);
const local = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).toISOString();

describe("lobbyTimesFrom", () => {
  it("reads the date and clock times as local time", () => {
    expect(lobbyTimesFrom("2026-11-05", "18:00", "21:30", now)).toEqual({
      ok: true,
      startsAt: local(5, 18),
      endsAt: local(5, 21, 30),
    });
  });

  it("reads an end clock time before the start as the next day", () => {
    expect(lobbyTimesFrom("2026-11-05", "22:00", "02:00", now)).toEqual({
      ok: true,
      startsAt: local(5, 22),
      endsAt: local(6, 2),
    });
  });

  it("denies an end equal to the start", () => {
    expect(lobbyTimesFrom("2026-11-05", "18:00", "18:00", now)).toEqual({
      ok: false,
      code: "lobby_end_not_after_start",
    });
  });

  it("denies a start that has passed and allows one a minute ahead", () => {
    expect(lobbyTimesFrom("2026-11-04", "11:59", "13:00", now)).toEqual({
      ok: false,
      code: "lobby_in_past",
    });
    expect(lobbyTimesFrom("2026-11-04", "12:01", "13:00", now).ok).toBe(true);
  });

  it.each([
    ["", "18:00", "20:00"],
    ["2026-11-05", "", "20:00"],
    ["2026-11-05", "18:00", ""],
    ["2026-02-31", "18:00", "20:00"],
  ])("denies a missing or impossible value: %s %s %s", (date, start, end) => {
    expect(lobbyTimesFrom(date, start, end, now)).toEqual({
      ok: false,
      code: "lobby_time_missing",
    });
  });
});

describe("endsNextDay", () => {
  it("is true only when the end is on a later calendar day", () => {
    expect(endsNextDay({ startsAt: local(5, 22), endsAt: local(6, 2) })).toBe(
      true,
    );
    expect(
      endsNextDay({ startsAt: local(5, 18), endsAt: local(5, 23, 59) }),
    ).toBe(false);
  });
});

describe("localDateText", () => {
  it("pads month and day", () => {
    expect(localDateText(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("calendar suggestions", () => {
  it("writes a clock time with two digits", () => {
    expect(localClockText(new Date(2026, 10, 5, 7, 5))).toBe("07:05");
  });

  it("suggests an end two hours later, also across midnight", () => {
    expect(suggestedEnd(new Date(2026, 10, 5, 23, 30))).toEqual(
      new Date(2026, 10, 6, 1, 30),
    );
  });
});
