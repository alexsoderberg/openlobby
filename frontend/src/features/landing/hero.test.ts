import { describe, expect, it, vi } from "vitest";
import { formatTime } from "../../i18n";
import { en } from "../../i18n/messages/en";
import {
  HERO_CARD_LAYOUT,
  HERO_MAX_TILT_RAD,
  HERO_ROW_WIDTH,
  HERO_VIEW_HEIGHT,
  chooseHeroMode,
  clampTilt,
  easeToward,
  heroCardContents,
  heroRowScale,
  pointerToUnit,
  staticCardStyle,
} from "./hero";

describe("chooseHeroMode", () => {
  it("is static for reduced motion, without checking WebGL", () => {
    const hasWebGL = vi.fn(() => true);
    expect(chooseHeroMode(true, hasWebGL)).toBe("static");
    expect(hasWebGL).not.toHaveBeenCalled();
  });

  it("is static without WebGL", () => {
    expect(chooseHeroMode(false, () => false)).toBe("static");
  });

  it("is a scene otherwise", () => {
    expect(chooseHeroMode(false, () => true)).toBe("scene");
  });
});

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

describe("heroCardContents", () => {
  it("gives one card per layout slot with the players text of the app", () => {
    const cards = heroCardContents(en);

    expect(cards).toHaveLength(HERO_CARD_LAYOUT.length);
    expect(cards[0].spotsText).toBe(en.lobbyPlayers(3, 5));
    expect(cards[0].timeText).toBe(formatTime("2030-01-05T19:00:00"));
    expect(cards.map((card) => card.gameName)).toEqual(en.landing.heroGames);
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
    const { width, transform } = staticCardStyle(HERO_CARD_LAYOUT[1]);

    expect(width).toContain(`var(--stage-height) / ${HERO_VIEW_HEIGHT}`);
    expect(width).toContain(`var(--stage-width) / ${HERO_ROW_WIDTH}`);
    expect(transform).toContain("rotate(0rad)");
  });
});
