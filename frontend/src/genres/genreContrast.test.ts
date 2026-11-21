import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WCAG_AA_TEXT,
  contrastRatio,
  publicDir,
  solid,
  stylesheet,
  token,
} from "../test/cssTokens";
import { GENRE_THEMES } from "./genreThemes";

// Until PR5a removes the genre look (ADR 0028 section 7), the accents are decoration on the dark theme: no text and
// no meter is drawn in an accent. These tests pin that the text and muted colours still read on every plate the look
// paints.

/** A translucent layer: a colour at an alpha. */
type Layer = readonly [colour: string, alpha: number];

const channels = (hex: string) =>
  [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));

/** Paints the layers in order over a backdrop, the way the browser stacks them, and returns the plate the text sits on. */
function plate(layers: Layer[], backdrop: string): string {
  let current = channels(backdrop);
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
const texts = () => [solid("--color-text"), solid("--color-muted")];
/** The hover fill of a row: the solid raised colour on its layer. */
const raised = (): Layer => [solid("--color-raised"), 1];

/** The real stacks, worst case where parts overlap, over their backdrop: what is painted behind the text in each view. */
const views: Record<string, (accent: string) => [Layer[], string]> = {
  "lobby row": (accent) => [
    [[accent, PATTERN_ALPHA]],
    solid("--color-surface"),
  ],
  "lobby row on hover": (accent) => [
    [raised(), [accent, PATTERN_ALPHA]],
    solid("--color-surface"),
  ],
  "week block": (accent) => [
    [
      [accent, PATTERN_ALPHA],
      [accent, percent("--genre-tint")],
    ],
    solid("--color-ground"),
  ],
  "Next up card and lobby head": (accent) => [
    [
      [accent, PATTERN_ALPHA],
      [accent, MOTIF_ALPHA],
    ],
    solid("--color-surface"),
  ],
  // The wash is mixed into the surface, so the plate is the same on a hovered card (pinned below).
  "Group card lobby line": (accent) => [
    [
      [accent, percent("--genre-wash")],
      [accent, PATTERN_ALPHA],
    ],
    solid("--color-surface"),
  ],
};

it("mixes the Group card lobby line's wash into the surface, so a hovered card cannot show through", () => {
  expect(stylesheet).toMatch(
    /\.group-card__lobby\s*\{[^}]*color-mix\(\s*in srgb,\s*var\(--genre-accent\) var\(--genre-wash\),\s*var\(--color-surface\)\s*\)/,
  );
});

const stacks = accents.flatMap(({ key, accent }) =>
  Object.entries(views).map(([view, layers]) => {
    const [over, backdrop] = layers(accent);
    return [`${key} ${view}`, plate(over, backdrop)] as const;
  }),
);

describe("genre theme contrast (WCAG AA)", () => {
  it("has nine accents, all different", () => {
    expect(new Set(accents.map(({ accent }) => accent)).size).toBe(9);
  });

  it.each(stacks)(
    "%s: text and muted read at 4.5:1 or more on the composed plate",
    (_, behind) => {
      for (const text of texts())
        expect(
          contrastRatio(text, behind),
          `${text} on ${behind}`,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );

  it("draws no text in a genre accent", () => {
    expect(stylesheet).not.toMatch(/[^-]color:\s*var\(--genre-accent\)/);
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

/**
 * A game cover can be any image. Under the dark scrim the lightest cover, pure white, is the bound for the text
 * colour. Next up and the lobby head add the motif; a hovered lobby row its raised fill, which a covered row draws
 * over the scrim (ADR 0026 point 8).
 */
const WHITE_COVER = "#ffffff";
const coverViews: Record<string, (accent: string) => Layer[]> = {
  "Next up card and lobby head": (accent) => [
    rgbaLayer("--color-cover-scrim"),
    [accent, MOTIF_ALPHA],
  ],
  "lobby row": () => [rgbaLayer("--color-cover-scrim")],
  "lobby row on hover": () => [rgbaLayer("--color-cover-scrim"), raised()],
};
const coverStacks = accents.flatMap(({ key, accent }) =>
  Object.entries(coverViews).map(
    ([view, layers]) =>
      [`${key} ${view}`, plate(layers(accent), WHITE_COVER)] as const,
  ),
);
/** The rules of a covered frame, joined: they swap muted text, the genre name and a field error to the text colour. */
const coverRules = [
  ...stylesheet.matchAll(/([^{}]*\[data-cover\][^{}]*)\{([^}]*)\}/g),
]
  .map(([, selector, body]) => `${selector.trim()} {${body}}`)
  .join(" ");

describe("game cover contrast (WCAG AA, worst case: a white cover)", () => {
  it.each(coverStacks)("%s: text reads at 4.5:1 or more", (_, behind) => {
    expect(contrastRatio(solid("--color-text"), behind)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
  });

  it("gives muted text, the genre name and a field error the tested text colour on a cover", () => {
    expect(coverRules).toMatch(/--color-muted:\s*var\(--color-text\)/);
    for (const name of ["genre-name", "field-error"])
      expect(coverRules, name).toMatch(
        new RegExp(
          String.raw`\.${name}[^{]*\{[^}]*color:\s*var\(--color-text\)`,
        ),
      );
  });

  it("draws a covered row's hover fill over the scrim, as tested", () => {
    expect(coverRules).toMatch(/\.row-list[^{]*::after\s*\{[^}]*z-index:\s*-1/);
  });
});
