import { describe, expect, it } from "vitest";
import { themeForGenre } from "../../genres";
import { WCAG_AA_TEXT, contrastRatio, solid } from "../../test/cssTokens";
import { HERO_SAMPLE_CARDS } from "./hero";
import {
  CARD_PADDING,
  CARD_TINT_ALPHA,
  FULL_STROKE_WIDTH,
  GLOW_BLUR,
} from "./heroCardPainter";

const PATTERN_ALPHA = 0.08; // the strongest stroke in public/genre-art, pinned by genreContrast.test.ts
/** Share of a Gaussian beyond `sigmas` standard deviations (erfc by Abramowitz and Stegun 7.1.26). */
function gaussianTail(sigmas: number) {
  const x = sigmas / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return (poly * Math.exp(-x * x)) / 2;
}

/**
 * The halo of a full card, from the painter's own constants: the canvas blur has a sigma of half the blur value,
 * and it starts at the visible inner edge of the stroke (half the stroke width, the rest is clipped).
 * Text starts one padding from the edge. At the corner, where the time pill sits, two edges add up.
 */
const HALO_ALPHA =
  2 * gaussianTail((CARD_PADDING - FULL_STROKE_WIDTH / 2) / (GLOW_BLUR / 2));

function blend(over: string, alpha: number, under: string) {
  const mix = (start: number) =>
    Math.round(
      Number.parseInt(over.slice(start, start + 2), 16) * alpha +
        Number.parseInt(under.slice(start, start + 2), 16) * (1 - alpha),
    );
  return `#${[1, 3, 5].map((start) => mix(start).toString(16).padStart(2, "0")).join("")}`;
}

describe.each(HERO_SAMPLE_CARDS)("hero card text ($genre)", ({ genre }) => {
  const accent = solid(themeForGenre(genre).accentVar);
  const surface = solid("--color-bg-raised");
  const plates = {
    filling: blend(accent, PATTERN_ALPHA, surface),
    full: blend(
      solid("--color-online"),
      HALO_ALPHA,
      blend(accent, PATTERN_ALPHA, surface),
    ),
  };

  it.each(Object.entries(plates))(
    "reads at 4.5:1 or more in the %s state",
    (_, plate) => {
      for (const text of [solid("--color-text"), solid("--color-muted-themed")])
        expect(contrastRatio(text, plate), text).toBeGreaterThanOrEqual(
          WCAG_AA_TEXT,
        );
      const pill = blend(accent, CARD_TINT_ALPHA, plate);
      expect(contrastRatio(accent, pill)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );
});
