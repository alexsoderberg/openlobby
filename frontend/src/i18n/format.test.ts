import { describe, expect, it } from "vitest";
import { formatDateTimeRange, formatTimeRange } from "./format";

// Local constructors and counting the formatter's own day text keep this true in any locale and time zone.
const dayOnly = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});
const occurrences = (text: string, part: string) => text.split(part).length - 1;

describe("formatDateTimeRange", () => {
  it("shows the date once when the end is the same day", () => {
    const start = new Date(2026, 10, 5, 18);
    const text = formatDateTimeRange(start, new Date(2026, 10, 5, 20));
    expect(occurrences(text, dayOnly.format(start))).toBe(1);
  });

  it("shows both dates when the end is the next day", () => {
    const start = new Date(2026, 10, 5, 22);
    const end = new Date(2026, 10, 6, 2);
    const text = formatDateTimeRange(start.toISOString(), end.toISOString());
    expect(text).toContain(dayOnly.format(start));
    expect(text).toContain(dayOnly.format(end));
  });
});

describe("formatTimeRange", () => {
  it("shows no date", () => {
    const start = new Date(2026, 10, 5, 22);
    const text = formatTimeRange(start, new Date(2026, 10, 6, 2));
    expect(text).not.toContain(dayOnly.format(start));
  });
});
