import { describe, expect, it } from "vitest";
import { nextWeekStart, weekDays, weekItems, weekStartOf } from "./week";

const span = (id: string, start: Date, end: Date) => ({
  id,
  startsAt: start.toISOString(),
  endsAt: end.toISOString(),
});
const at = (day: number, hour: number) => new Date(2026, 10, day, hour);

describe("weekStartOf", () => {
  it.each([
    [new Date(2026, 10, 4, 15), 2], // Wednesday
    [new Date(2026, 10, 2, 0), 2], // Monday
    [new Date(2026, 10, 8, 23, 59), 2], // Sunday belongs to the week that began on Monday
    [new Date(2026, 10, 9), 9],
  ])("starts the week of %s on Monday the %s", (date, day) => {
    expect(weekStartOf(date)).toEqual(new Date(2026, 10, day));
  });
});

describe("weekDays and nextWeekStart", () => {
  it("lists seven days Monday to Sunday and steps a whole week", () => {
    const days = weekDays(new Date(2026, 10, 2));
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual(new Date(2026, 10, 8));
    expect(nextWeekStart(days[0])).toEqual(new Date(2026, 10, 9));
  });
});

describe("weekItems", () => {
  it("puts an item that crosses midnight on both days and leaves out other weeks", () => {
    const overnight = span("night", at(4, 22), at(5, 2));
    const nextWeek = span("later", at(10, 12), at(10, 13));
    const week = weekItems(new Date(2026, 10, 2), [overnight, nextWeek]);
    expect(week.map((entry) => entry.items.length)).toEqual([
      0, 0, 1, 1, 0, 0, 0,
    ]);
    expect(week[3].items).toEqual([overnight]);
  });

  it("does not put an item that ends at midnight on the next day", () => {
    const toMidnight = span("edge", at(4, 22), at(5, 0));
    const week = weekItems(new Date(2026, 10, 2), [toMidnight]);
    expect(week[3].items).toEqual([]);
  });

  it("puts an item that started before Monday and still runs on Monday, but not one that has ended", () => {
    const carried = span("carried", new Date(2026, 10, 1, 22), at(2, 3));
    const ended = span("ended", new Date(2026, 10, 1, 20), at(2, 0));
    const week = weekItems(new Date(2026, 10, 2), [ended, carried]);
    expect(week[0].items).toEqual([carried]);
  });

  it("puts an item that ends after Sunday on Sunday only", () => {
    const running = span("running", at(8, 22), at(9, 3));
    const week = weekItems(new Date(2026, 10, 2), [running]);
    expect(week[6].items).toEqual([running]);
    expect(week.flatMap((entry) => entry.items)).toHaveLength(1);
  });

  it("keeps the order it was given within a day", () => {
    const late = span("late", at(4, 21), at(4, 22));
    const early = span("early", at(4, 18), at(4, 19));
    expect(weekItems(new Date(2026, 10, 2), [early, late])[2].items).toEqual([
      early,
      late,
    ]);
  });
});
