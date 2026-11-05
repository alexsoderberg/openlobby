import { describe, expect, it } from "vitest";
import {
  clickableFromMinute,
  dayBlocks,
  initialScrollMinute,
  momentAt,
  roundDownToHalfHour,
} from "./gridGeometry";

const lobby = (id: string, start: Date, end: Date) => ({
  id,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
});
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute);
const WEDNESDAY = at(4, 0);

describe("dayBlocks", () => {
  it("turns start and end into minutes from midnight", () => {
    const [block] = dayBlocks(WEDNESDAY, [
      lobby("a", at(4, 18, 30), at(4, 20)),
    ]);
    expect(block).toMatchObject({
      startMinute: 18 * 60 + 30,
      endMinute: 20 * 60,
      continuesBefore: false,
      continuesAfter: false,
    });
  });

  it("cuts a lobby that crosses midnight into one part per day", () => {
    const night = lobby("night", at(4, 22), at(5, 2));
    expect(dayBlocks(at(4, 0), [night])[0]).toMatchObject({
      startMinute: 22 * 60,
      endMinute: 24 * 60,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(dayBlocks(at(5, 0), [night])[0]).toMatchObject({
      startMinute: 0,
      endMinute: 2 * 60,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it("shows the rest on a day when the lobby started the week before", () => {
    const carried = lobby("carried", new Date(2026, 10, 1, 22), at(2, 3));
    expect(dayBlocks(at(2, 0), [carried])[0]).toMatchObject({
      startMinute: 0,
      endMinute: 3 * 60,
      continuesBefore: true,
    });
  });

  it("runs a lobby that ends at midnight to the bottom without marking a continuation", () => {
    const [block] = dayBlocks(at(4, 0), [lobby("edge", at(4, 22), at(5, 0))]);
    expect(block).toMatchObject({ endMinute: 24 * 60, continuesAfter: false });
  });

  it("clips a lobby that runs past the day to the end of the day", () => {
    const [block] = dayBlocks(at(8, 0), [lobby("long", at(8, 20), at(10, 5))]);
    expect(block).toMatchObject({ endMinute: 24 * 60, continuesAfter: true });
  });

  it("counts wall-clock minutes on days with a daylight-saving change", () => {
    // Whatever the time zone, 22:00 on a changing day is minute 1320 and the part after midnight ends at 02:00.
    for (const [month, day] of [
      [9, 25],
      [10, 1],
      [2, 29],
      [2, 8],
    ]) {
      const night = lobby(
        "night",
        new Date(2026, month, day, 22),
        new Date(2026, month, day + 1, 2),
      );
      expect(dayBlocks(new Date(2026, month, day), [night])[0]).toMatchObject({
        startMinute: 22 * 60,
        endMinute: 24 * 60,
      });
      expect(
        dayBlocks(new Date(2026, month, day + 1), [night])[0],
      ).toMatchObject({ startMinute: 0, endMinute: 2 * 60 });
    }
  });

  it("places overlapping lobbies side by side and lets a later one reuse a free column", () => {
    const blocks = dayBlocks(WEDNESDAY, [
      lobby("a", at(4, 18), at(4, 22)),
      lobby("b", at(4, 19), at(4, 20)),
      lobby("c", at(4, 20), at(4, 21)),
    ]);
    expect(
      blocks.map(({ item, column, columns }) => [item.id, column, columns]),
    ).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 1, 2],
    ]);
  });

  it("gives lobbies that do not overlap the whole width each", () => {
    const blocks = dayBlocks(WEDNESDAY, [
      lobby("a", at(4, 10), at(4, 12)),
      lobby("b", at(4, 12), at(4, 14)),
      lobby("c", at(4, 18), at(4, 20)),
      lobby("d", at(4, 19), at(4, 21)),
    ]);
    expect(blocks.map(({ item, columns }) => [item.id, columns])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 2],
      ["d", 2],
    ]);
  });
});

describe("initialScrollMinute", () => {
  it("is 16:00 when nothing starts earlier, also with no lobbies", () => {
    expect(initialScrollMinute([])).toBe(16 * 60);
    expect(initialScrollMinute([{ startMinute: 20 * 60 }])).toBe(16 * 60);
  });

  it("is the hour of the earliest lobby when that is before 16:00", () => {
    expect(
      initialScrollMinute([
        { startMinute: 20 * 60 },
        { startMinute: 9 * 60 + 40 },
      ]),
    ).toBe(9 * 60);
  });
});

describe("half hours and clickable times", () => {
  it.each([
    [0, 0],
    [29, 0],
    [30, 30],
    [89, 60],
    [1439, 1410],
  ])("rounds minute %i down to %i", (minute, expected) => {
    expect(roundDownToHalfHour(minute)).toBe(expected);
  });

  it("can start a lobby on any minute of a later day, from the next half hour on today, and never in the past", () => {
    const now = at(4, 12, 10);
    expect(clickableFromMinute(at(3, 0), now)).toBeUndefined();
    expect(clickableFromMinute(at(4, 0), now)).toBe(12 * 60 + 30);
    expect(clickableFromMinute(at(4, 0), at(4, 12, 30))).toBe(12 * 60 + 30);
    expect(clickableFromMinute(at(4, 0), at(4, 23, 50))).toBeUndefined();
    expect(clickableFromMinute(at(5, 0), now)).toBe(0);
  });

  it("builds the local moment of a minute", () => {
    expect(momentAt(at(5, 0), 18 * 60 + 30)).toEqual(at(5, 18, 30));
  });
});
