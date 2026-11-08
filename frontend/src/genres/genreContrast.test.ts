import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WCAG_AA_TEXT,
  WCAG_AA_UI,
  contrastRatio,
  publicDir,
  solid,
  stylesheet,
  token,
} from "../test/cssTokens";
import { GENRE_THEMES } from "./genreThemes";

/** A translucent layer: a colour at an alpha. */
type Layer = readonly [colour: string, alpha: number];

const channels = (hex: string) =>
  [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));

/** Paints the layers in order over the page, the way the browser stacks them, and returns the plate the text sits on. */
function plate(layers: Layer[]): string {
  let current = channels(solid("--color-bg"));
  for (const [colour, alpha] of layers)
    current = channels(colour).map((over, index) =>
      Math.round(over * alpha + current[index] * (1 - alpha)),
    );
  return `#${current.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

/** An rgba() token as a layer. */
function rgbaLayer(name: string): Layer {
  const [, red, green, blue, alpha] =
    /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(token(name)) ?? [];
  const hex = [red, green, blue]
    .map((value) => Number(value).toString(16).padStart(2, "0"))
    .join("");
  return [`#${hex}`, Number(alpha)];
}

const percent = (name: string) => Number.parseInt(token(name), 10) / 100;
const PATTERN_ALPHA = 0.08;
const MOTIF_ALPHA = Number(token("--genre-motif-opacity"));
const accents = Object.values(GENRE_THEMES).map((theme) => ({
  key: theme.key,
  accent: solid(theme.accentVar).toLowerCase(),
}));

/**
 * The real stacks, worst case where parts overlap: what is painted behind the text in each view.
 * Next up and the lobby head put the pattern and the motif over the panel fill; Next up adds the accent wash;
 * the week block puts its tint over the pattern.
 */
const views: Record<string, (accent: string) => Layer[]> = {
  "lobby row": (accent) => [[accent, PATTERN_ALPHA]],
  "lobby row on hover": (accent) => [
    rgbaLayer("--color-row-hover"),
    [accent, PATTERN_ALPHA],
  ],
  "week block": (accent) => [
    [accent, PATTERN_ALPHA],
    [accent, percent("--genre-tint")],
  ],
  "Next up card": (accent) => [
    rgbaLayer("--color-surface"),
    [accent, percent("--genre-wash")],
    [accent, PATTERN_ALPHA],
    [accent, MOTIF_ALPHA],
  ],
  "lobby head": (accent) => [
    rgbaLayer("--color-surface"),
    [accent, PATTERN_ALPHA],
    [accent, MOTIF_ALPHA],
  ],
};

const stacks = accents.flatMap(({ key, accent }) =>
  Object.entries(views).map(
    ([view, layers]) =>
      [`${key} ${view}`, accent, plate(layers(accent))] as const,
  ),
);

describe("genre theme contrast (WCAG AA)", () => {
  it("has nine accents, all different", () => {
    expect(new Set(accents.map(({ accent }) => accent)).size).toBe(9);
  });

  it.each(accents)(
    "$key: the accent carries meaning at 3:1 or more on the page",
    ({ accent }) => {
      expect(contrastRatio(accent, solid("--color-bg"))).toBeGreaterThanOrEqual(
        WCAG_AA_UI,
      );
    },
  );

  it.each(stacks)(
    "%s: text reads at 4.5:1 or more on the composed plate",
    (_, accent, behind) => {
      for (const text of [
        accent,
        solid("--color-text"),
        solid("--color-muted-themed"),
      ])
        expect(
          contrastRatio(text, behind),
          `${text} on ${behind}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );

  it("keeps the gold Next up text readable on the Next up plate", () => {
    for (const { accent } of accents)
      expect(
        contrastRatio(
          solid("--color-accent"),
          plate(views["Next up card"](accent)),
        ),
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it("draws the art in the token colour and the patterns no stronger than the tested alpha", () => {
    for (const theme of Object.values(GENRE_THEMES)) {
      const accent = solid(theme.accentVar).toLowerCase();
      for (const url of [theme.iconUrl, theme.motifUrl, theme.patternUrl]) {
        const svg = readFileSync(join(publicDir, url), "utf8").toLowerCase();
        const colours = svg.match(/#[0-9a-f]{6}/g) ?? [];
        expect(new Set(colours).size, url).toBeLessThanOrEqual(1);
        for (const colour of colours) expect(colour, url).toBe(accent);
      }
      const pattern = readFileSync(join(publicDir, theme.patternUrl), "utf8");
      for (const [, alpha] of pattern.matchAll(/-opacity="([\d.]+)"/g))
        expect(Number(alpha)).toBeLessThanOrEqual(PATTERN_ALPHA);
    }
  });

  it("has no transition or animation in any genre rule", () => {
    const rules = [...stylesheet.matchAll(/([^{}]*genre[^{}]*)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const [, selector, body] of rules)
      if (!selector.includes(":root"))
        expect(body, selector).not.toMatch(/animation|transition/);
  });
});
