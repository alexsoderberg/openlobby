import { describe, expect, it } from "vitest";
import { en } from "../../i18n/messages/en";
import { timingText } from "./countdown";

const START = Date.UTC(2026, 10, 10, 20, 0, 0);
const END = START + 3_600_000;
const lobby = {
  startsAt: new Date(START).toISOString(),
  endsAt: new Date(END).toISOString(),
};
const minutes = (count: number) => count * 60_000;
const hours = (count: number) => minutes(count * 60);

describe("timingText", () => {
  it.each([
    [hours(51) + minutes(59), "in 2 d 3 h"],
    [hours(24), "in 1 d 0 h"],
    [hours(3) + minutes(12) + 59_000, "in 3 h 12 min"],
    [hours(1), "in 1 h 0 min"],
    [minutes(12) + 30_000, "in 12 min"],
    [minutes(1), "in 1 min"],
    [59_999, "in under a minute"],
  ])("counts down %i ms before the start as %j", (before, text) => {
    expect(timingText(en.dashboard, lobby, START - before)).toBe(text);
  });

  it("says Running from the start until the end", () => {
    expect(timingText(en.dashboard, lobby, START)).toBe("Running");
    expect(timingText(en.dashboard, lobby, END - 1)).toBe("Running");
  });

  it("says Ended from the end", () => {
    expect(timingText(en.dashboard, lobby, END)).toBe("Ended");
  });
});
