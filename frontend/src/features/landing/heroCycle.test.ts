import { describe, expect, it } from "vitest";
import {
  heroCardCount,
  heroCardSeconds,
  heroFrameAt,
  isSameHeroFrame,
  type HeroTiming,
} from "./heroCycle";

const TIMING: HeroTiming = {
  enterSeconds: 1,
  stepSeconds: 1,
  glowSeconds: 1.5,
  leaveSeconds: 1,
};
const CARDS = [
  { startCount: 2, maxCount: 5 },
  { startCount: 1, maxCount: 4 },
  { startCount: 3, maxCount: 8 },
];
const at = (seconds: number) => heroFrameAt(seconds, CARDS, TIMING);

describe("heroCardSeconds", () => {
  it("is enter + arrivals + glow + leave, within 6 to 10 seconds", () => {
    const seconds = CARDS.map((card) => heroCardSeconds(card, TIMING));

    expect(seconds).toEqual([6.5, 6.5, 8.5]);
    seconds.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(6);
      expect(value).toBeLessThanOrEqual(10);
    });
  });
});

describe("heroFrameAt", () => {
  it("enters at the start count, then one arrival per step up to the max", () => {
    expect(at(0)).toMatchObject({ focusIndex: 0, phase: "enter", count: 2 });
    expect(at(0.99).count).toBe(2);
    expect(at(1)).toMatchObject({ phase: "fill", count: 2 });
    expect(at(1.99).count).toBe(2);
    expect(at(2).count).toBe(3);
    expect(at(3).count).toBe(4);
    expect(at(4)).toMatchObject({ phase: "full", count: 5 });
  });

  it("holds the full state for the glow time, then leaves for the leave time", () => {
    expect(at(5.49).phase).toBe("full");
    expect(at(5.5)).toMatchObject({ phase: "leave", count: 5, focusIndex: 0 });
    expect(at(6.49).phase).toBe("leave");
  });

  it("gives the focus to the next card after the leave", () => {
    expect(at(6.5)).toMatchObject({ focusIndex: 1, phase: "enter", count: 1 });
    expect(at(13)).toMatchObject({ focusIndex: 2, phase: "enter", count: 3 });
  });

  it("restarts with the first card after the last, with no end state", () => {
    const cycle = CARDS.reduce(
      (sum, card) => sum + heroCardSeconds(card, TIMING),
      0,
    );

    expect(cycle).toBe(21.5);
    expect(at(cycle - 0.01).phase).toBe("leave");
    expect(at(cycle)).toMatchObject({
      focusIndex: 0,
      phase: "enter",
      count: 2,
    });
    expect(at(cycle * 5 + 2)).toEqual(at(2));
  });

  it("reports how far through the phase it is", () => {
    expect(at(0.25).progress).toBeCloseTo(0.25);
    expect(at(5.75).progress).toBeCloseTo(0.25);
  });
});

describe("heroCardCount", () => {
  it("is the live count for the focused card and the start count for the rest", () => {
    const frame = at(3);

    expect(heroCardCount(0, frame, CARDS)).toBe(4);
    expect(heroCardCount(1, frame, CARDS)).toBe(1);
  });
});

describe("isSameHeroFrame", () => {
  it("ignores progress inside a phase, so a card is repainted only on a change", () => {
    expect(isSameHeroFrame(at(2.1), at(2.9))).toBe(true);
    expect(isSameHeroFrame(at(2.9), at(3))).toBe(false);
    expect(isSameHeroFrame(undefined, at(0))).toBe(false);
  });
});
