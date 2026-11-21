import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WCAG_AA_TEXT,
  WCAG_AA_UI,
  contrastRatio,
  cssRules,
  declarations,
  publicDir,
  solid,
  stylesheet,
  token,
} from "../test/cssTokens";

const fontFaces = Array.from(
  stylesheet.matchAll(/@font-face\s*\{([^}]*)\}/g),
  ([, body]) => body,
);
const GROUPS = [1, 2, 3, 4, 5, 6].map((index) => `--color-group-${index}`);
const PLATES = ["--color-ground", "--color-surface", "--color-raised"];

// The dark "Stage" theme of ADR 0028 section 16.2.
describe("design tokens", () => {
  it("is one dark theme", () => {
    expect(stylesheet).toMatch(/:root\s*\{\s*color-scheme:\s*dark;/);
    expect(stylesheet).not.toMatch(
      /color-scheme:\s*light|prefers-color-scheme/,
    );
  });

  it("has the values of section 16.2", () => {
    expect(
      Object.fromEntries(
        [
          "--color-ground",
          "--color-surface",
          "--color-raised",
          "--color-rule",
          "--color-rule-strong",
          "--color-control-line",
          "--color-text",
          "--color-muted",
          "--color-signal",
          "--color-on-signal",
          "--color-danger",
          "--color-on-group",
          ...GROUPS,
        ].map((name) => [name, solid(name).toLowerCase()]),
      ),
    ).toEqual({
      "--color-ground": "#161412",
      "--color-surface": "#201d1a",
      "--color-raised": "#2b2723",
      "--color-rule": "#332f2a",
      "--color-rule-strong": "#4b453f",
      "--color-control-line": "#7a7268",
      "--color-text": "#f2ede5",
      "--color-muted": "#aaa298",
      "--color-signal": "#ff6a2b",
      "--color-on-signal": "#161412",
      "--color-danger": "#ff7a85",
      "--color-on-group": "#161412",
      "--color-group-1": "#6f97f7",
      "--color-group-2": "#4fbf7f",
      "--color-group-3": "#e0b83a",
      "--color-group-4": "#ec7aa6",
      "--color-group-5": "#3dbab5",
      "--color-group-6": "#a98be8",
    });
  });

  it.each(PLATES)(
    "text, muted and danger text read at 4.5:1 or more on %s",
    (plate) => {
      for (const text of ["--color-text", "--color-muted", "--color-danger"])
        expect(
          contrastRatio(solid(text), solid(plate)),
          text,
        ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );

  // Signal is text only on the Next up band, a surface (section 16.4 item 4), and an icon on the ground or a surface.
  it.each(["--color-ground", "--color-surface"])(
    "signal reads at 4.5:1 or more on %s",
    (plate) => {
      expect(
        contrastRatio(solid("--color-signal"), solid(plate)),
      ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    },
  );

  it("reads on-signal text on the signal fill at 4.5:1 or more", () => {
    expect(
      contrastRatio(solid("--color-on-signal"), solid("--color-signal")),
    ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  // WCAG 1.4.11: the edge of a control and the focus ring stand out at 3:1 or more on every plate.
  it.each(PLATES)(
    "the control line and the focus ring stand out at 3:1 or more on %s",
    (plate) => {
      for (const line of ["--color-control-line", "--color-text"])
        expect(
          contrastRatio(solid(line), solid(plate)),
          line,
        ).toBeGreaterThanOrEqual(WCAG_AA_UI);
    },
  );

  // The Top bar takes an on-signal focus ring, since the text colour is under 3:1 there.
  it("the focus ring on the Top bar stands out at 3:1 or more on signal", () => {
    expect(
      contrastRatio(solid("--color-on-signal"), solid("--color-signal")),
    ).toBeGreaterThanOrEqual(WCAG_AA_UI);
  });

  // A block stands out from the page (REQ-0029, WCAG 1.4.11).
  it.each(GROUPS)("%s stands out at 3:1 or more on the ground", (group) => {
    expect(
      contrastRatio(solid(group), solid("--color-ground")),
    ).toBeGreaterThanOrEqual(WCAG_AA_UI);
  });

  it.each(GROUPS)("%s carries on-group text at 4.5:1 or more", (group) => {
    expect(
      contrastRatio(solid("--color-on-group"), solid(group)),
    ).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it("has six distinct group colours, none equal to signal or danger", () => {
    const colours = GROUPS.map((group) => solid(group).toLowerCase());
    expect(new Set(colours).size).toBe(6);
    for (const reserved of ["--color-signal", "--color-danger"])
      expect(colours).not.toContain(solid(reserved).toLowerCase());
  });

  // Section 16.2 renamed them without aliases; section 16.5 merged the ADR 0023 radii into two.
  it.each([
    "--color-ink",
    "--color-ink-soft",
    "--color-orange",
    "--color-wash",
    "--color-focus",
    "--radius-panel",
    "--radius-popover",
    "--radius-control",
    "--radius-badge",
    "--radius-chip",
  ])("has no %s", (name) => {
    expect(stylesheet).not.toMatch(new RegExp(`${name}(?![\\w-])`));
  });

  it("has two radius tokens only", () => {
    expect(token("--radius")).toBe("8px");
    expect(token("--radius-sm")).toBe("4px");
  });

  it("sets the heading and text fonts, each with a generic fallback", () => {
    expect(token("--font-heading")).toMatch(
      /^"Big Shoulders Display",.*sans-serif$/,
    );
    expect(token("--font-text")).toMatch(/^"Archivo",.*sans-serif$/);
  });

  // Big Shoulders Display ships at 800 and 900 only; a lighter weight would render as 800 anyway.
  it("sets the heading font only in a shipped weight", () => {
    const weights = cssRules
      .filter(({ body }) => /font-family:\s*var\(--font-heading\)/.test(body))
      .flatMap(({ body }) =>
        Array.from(
          body.matchAll(/font-weight:\s*(\d+)/g),
          ([, weight]) => weight,
        ),
      );
    expect(weights.length).toBeGreaterThan(0);
    expect(new Set(weights)).toEqual(new Set(["800", "900"]));
  });

  it("declares the five self-hosted font faces", () => {
    expect(fontFaces).toHaveLength(5);
  });

  it("ships no Space Grotesk, Inter or serif font", () => {
    const files = readdirSync(join(publicDir, "fonts")).join();
    expect(files).not.toMatch(/space-?grotesk|inter|cormorant/i);
    expect(stylesheet).not.toMatch(/Space Grotesk|"Inter"/);
  });

  // optional: a file that is not ready in time leaves the fallback in place, so nothing shifts (REQ-0029 item 2).
  it("loads every font face with font-display: optional from a file that exists", () => {
    for (const face of fontFaces) {
      expect(face).toMatch(/font-display:\s*optional;/);
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
    // Radix sets its --radix-* values on the element at run time (the side the dropdown list grew from).
    const used = Array.from(
      stylesheet.matchAll(/var\((--[\w-]+)\)/g),
      ([, name]) => name,
    ).filter((name) => !name.startsWith("--radix-"));
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
