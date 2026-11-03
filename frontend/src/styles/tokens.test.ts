import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Reads global.css as text: the tokens and the font rules are the contract that later screens rely on.
const stylesheet = readFileSync(
  join(import.meta.dirname, "global.css"),
  "utf8",
);
const publicDir = join(import.meta.dirname, "../../public");

const WCAG_AA_TEXT = 4.5;
const WCAG_AA_UI = 3;

const rootBlock = /:root\s*\{([^}]*)\}/.exec(stylesheet)?.[1] ?? "";
const declarations = new Map(
  Array.from(
    rootBlock.matchAll(/(--[\w-]+):\s*([^;]+);/g),
    ([, name, value]) => [name, value.trim()],
  ),
);

/** Resolves a token, following `var(--other)` references. */
function token(name: string): string {
  const value = declarations.get(name);
  if (value === undefined)
    throw new Error(`Token ${name} is not defined in :root`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference ? token(reference[1]) : value;
}

/** A solid #rrggbb token, as is. */
function solid(name: string): string {
  const value = token(name);
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`${name} is not a solid hex colour`);
  return value;
}

/** A translucent rgba token composited over --color-bg, giving the plate the text really sits on. */
function overPage(name: string): string {
  const match = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(token(name));
  if (!match) throw new Error(`${name} is not an rgba colour`);
  const [, red, green, blue, alpha] = match;
  const page = [1, 3, 5].map((start) =>
    Number.parseInt(solid("--color-bg").slice(start, start + 2), 16),
  );
  const over = [Number(red), Number(green), Number(blue)];
  return `#${over
    .map((channel, index) =>
      Math.round(channel * Number(alpha) + page[index] * (1 - Number(alpha))),
    )
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
function relativeLuminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const fontFaces = Array.from(
  stylesheet.matchAll(/@font-face\s*\{([^}]*)\}/g),
  ([, body]) => body,
);

describe("design tokens", () => {
  // Plates: the page itself, the top of the page gradient, the panel fill (rgba .03 over --color-bg)
  // and the badge tint (rgba .12 over --color-bg).
  const pagePlates = {
    "--color-bg": solid("--color-bg"),
    "--color-bg-raised": solid("--color-bg-raised"),
    "panel fill (--color-surface over --color-bg)": overPage("--color-surface"),
    "list row hover (--color-row-hover over --color-bg)":
      overPage("--color-row-hover"),
  };

  it.each(Object.entries(pagePlates))(
    "body text reads at 4.5:1 or more on %s",
    (_, plate) => {
      expect(
        contrastRatio(solid("--color-text"), plate),
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );

  it.each(Object.entries(pagePlates))(
    "muted text reads at 4.5:1 or more on %s",
    (_, plate) => {
      expect(
        contrastRatio(solid("--color-muted"), plate),
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );

  it.each(Object.entries(pagePlates))(
    "danger text reads at 4.5:1 or more on %s",
    (_, plate) => {
      expect(
        contrastRatio(solid("--color-danger"), plate),
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );

  it("danger text reads at 4.5:1 or more on the alert fill", () => {
    expect(
      contrastRatio(solid("--color-danger"), solid("--color-danger-bg")),
    ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it("text on the accent reads at 4.5:1 or more", () => {
    expect(
      contrastRatio(solid("--color-on-accent"), solid("--color-accent")),
    ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it("accent and focus ring stand out at 3:1 or more on the page", () => {
    expect(
      contrastRatio(solid("--color-accent"), solid("--color-bg")),
    ).toBeGreaterThanOrEqual(WCAG_AA_UI);
    expect(token("--color-focus")).toBe(token("--color-accent"));
  });

  it("accent and muted text read at 4.5:1 or more on the badge tint (--color-accent-tint over --color-bg)", () => {
    const tint = overPage("--color-accent-tint");
    expect(contrastRatio(solid("--color-accent"), tint)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
    expect(contrastRatio(solid("--color-muted"), tint)).toBeGreaterThanOrEqual(
      WCAG_AA_TEXT,
    );
  });

  it("the meter fill stands out at 3:1 or more on its track", () => {
    expect(
      contrastRatio(solid("--color-accent"), overPage("--color-border")),
    ).toBeGreaterThanOrEqual(WCAG_AA_UI);
  });

  it.each(["--font-display", "--font-heading", "--font-sans"])(
    "%s falls back to a generic family",
    (name) => {
      expect(token(name)).toMatch(/,\s*(serif|sans-serif)$/);
    },
  );

  it("declares the eight self-hosted font faces", () => {
    expect(fontFaces).toHaveLength(8);
  });

  it("loads every font face with font-display: swap from a file that exists", () => {
    for (const face of fontFaces) {
      expect(face).toMatch(/font-display:\s*swap;/);
      const urls = Array.from(
        face.matchAll(/url\("([^"]+)"\)/g),
        ([, url]) => url,
      );
      expect(urls).toHaveLength(1);
      expect(existsSync(join(publicDir, urls[0])), `missing ${urls[0]}`).toBe(
        true,
      );
    }
  });

  it("has no token that resolves to itself through var() chains", () => {
    for (const start of declarations.keys()) {
      const visited = new Set<string>();
      let name: string | undefined = start;
      while (name !== undefined) {
        expect(visited.has(name), `${start} is a var() cycle`).toBe(false);
        visited.add(name);
        name = /^var\((--[\w-]+)\)$/.exec(declarations.get(name) ?? "")?.[1];
      }
    }
  });

  it("uses only tokens that are defined in :root", () => {
    const used = Array.from(
      stylesheet.matchAll(/var\((--[\w-]+)\)/g),
      ([, name]) => name,
    );
    for (const name of used) {
      expect(declarations.has(name), `undefined token ${name}`).toBe(true);
    }
  });

  it("keeps colour and duration values inside :root", () => {
    const outsideRoot = stylesheet
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/:root\s*\{[^}]*\}/, "");
    expect(outsideRoot).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(outsideRoot).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    expect(outsideRoot).not.toMatch(/\b\d*\.?\d+m?s\b/);
  });

  it("turns off transitions and animations under prefers-reduced-motion", () => {
    const reducedMotion =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*)\}\s*$/.exec(
        stylesheet,
      )?.[1] ?? "";
    expect(reducedMotion).toMatch(/transition:\s*none !important;/);
    expect(reducedMotion).toMatch(/animation:\s*none !important;/);
  });

  it("shows scroll-revealed content at once under prefers-reduced-motion", () => {
    const reducedMotion =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*)\}\s*$/.exec(
        stylesheet,
      )?.[1] ?? "";
    expect(reducedMotion).toMatch(
      /\[data-reveal[^\]]*\][^{]*\{[^}]*opacity:\s*1;[^}]*transform:\s*none;/,
    );
  });
});
