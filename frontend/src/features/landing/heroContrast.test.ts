import { describe, expect, it } from "vitest";
import {
  WCAG_AA_TEXT,
  WCAG_AA_UI,
  contrastRatio,
  solid,
} from "../../test/cssTokens";

// The card is painted flat on the surface colour and shown unlit (heroScene.ts), so the plate is the token itself.
describe("hero card", () => {
  const plate = solid("--color-surface");

  it("reads its text and muted text at 4.5:1 or more", () => {
    for (const text of [solid("--color-text"), solid("--color-muted")])
      expect(contrastRatio(text, plate), text).toBeGreaterThanOrEqual(
        WCAG_AA_TEXT,
      );
  });

  it("shows a free spot's outline at 3:1 or more", () => {
    expect(
      contrastRatio(solid("--color-control-line"), plate),
    ).toBeGreaterThanOrEqual(WCAG_AA_UI);
  });
});
