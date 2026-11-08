import { describe, expect, it } from "vitest";
import { HERO_SAMPLE_CARDS, HERO_TIMING } from "./hero";
import { heroFrameAt } from "./heroCycle";
import {
  HERO_BEHIND,
  HERO_FRONT,
  HERO_MAX_TILT_RAD,
  HERO_ROW_WIDTH,
  HERO_VIEW_HEIGHT,
  clampTilt,
  easeToward,
  heroCardPose,
  heroRowScale,
  pointerToUnit,
  staticCardStyle,
} from "./heroPose";

describe("pointerToUnit", () => {
  it("maps the box edges and centre to -1, 0 and 1", () => {
    expect(pointerToUnit(100, 100, 400)).toBe(-1);
    expect(pointerToUnit(300, 100, 400)).toBe(0);
    expect(pointerToUnit(500, 100, 400)).toBe(1);
  });

  it("clamps a pointer outside the box and ignores an empty box", () => {
    expect(pointerToUnit(900, 100, 400)).toBe(1);
    expect(pointerToUnit(-50, 100, 400)).toBe(-1);
    expect(pointerToUnit(10, 0, 0)).toBe(0);
  });
});

describe("easeToward", () => {
  it("moves toward the target without overshooting", () => {
    const next = easeToward(0, 1, 0.016);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });

  it("stays put when no time passes", () => {
    expect(easeToward(0.3, 1, 0)).toBe(0.3);
  });
});

describe("clampTilt", () => {
  const SWAY = 0.04;

  it("keeps a corner pointer plus sway within the 12 degree total", () => {
    const [x, y] = clampTilt(
      -HERO_MAX_TILT_RAD - SWAY,
      HERO_MAX_TILT_RAD + SWAY,
    );

    expect(Math.hypot(x, y)).toBeCloseTo(HERO_MAX_TILT_RAD);
    expect(x).toBeCloseTo(-y); // the diagonal keeps its direction
  });

  it("leaves a tilt inside the limit as it is", () => {
    expect(clampTilt(0.05, -0.03)).toEqual([0.05, -0.03]);
    expect(clampTilt(0, 0)).toEqual([0, 0]);
  });
});

describe("heroRowScale", () => {
  it("shrinks the row only when the view is narrower than the row", () => {
    const fitsExactly = HERO_ROW_WIDTH / HERO_VIEW_HEIGHT;
    expect(heroRowScale(fitsExactly * 2)).toBe(1);
    expect(heroRowScale(fitsExactly / 2)).toBeCloseTo(0.5);
  });
});

describe("staticCardStyle", () => {
  it("uses the same fit rule as the scene, with y flipped for CSS", () => {
    const { width, transform } = staticCardStyle(HERO_FRONT);

    expect(width).toContain(`var(--stage-height) / ${HERO_VIEW_HEIGHT}`);
    expect(width).toContain(`var(--stage-width) / ${HERO_ROW_WIDTH}`);
    expect(transform).toContain("rotate(0rad)");
  });

  it("draws the card in front larger than the card behind, as the scene does", () => {
    const size = (place: typeof HERO_FRONT) =>
      Number(/\* ([\d.]+)\)$/.exec(staticCardStyle(place).width)?.[1]);

    expect(size(HERO_FRONT)).toBeGreaterThan(size(HERO_BEHIND));
  });
});

describe("heroCardPose", () => {
  const frame = (seconds: number) =>
    heroFrameAt(seconds, HERO_SAMPLE_CARDS, HERO_TIMING);

  it("puts the focused card in front and the next card behind it", () => {
    expect(heroCardPose(0, frame(2), 3)).toMatchObject({
      ...HERO_FRONT,
      opacity: 1,
    });
    expect(heroCardPose(1, frame(2), 3)).toMatchObject({
      ...HERO_BEHIND,
      opacity: 1,
    });
    expect(heroCardPose(2, frame(2), 3).opacity).toBe(0);
  });

  it("moves the next card from behind to the front while it enters", () => {
    expect(heroCardPose(1, frame(6.5), 3)).toMatchObject(HERO_BEHIND);
    expect(heroCardPose(1, frame(7.5), 3)).toMatchObject(HERO_FRONT);
  });

  it("fades the leaving card out and the one after the next card in", () => {
    expect(heroCardPose(0, frame(5.5), 3).opacity).toBe(1);
    expect(heroCardPose(0, frame(6.4), 3).opacity).toBeLessThan(0.1);
    expect(heroCardPose(2, frame(6.5), 3).opacity).toBe(0);
    expect(heroCardPose(2, frame(7.5), 3).opacity).toBeCloseTo(1);
  });
});
