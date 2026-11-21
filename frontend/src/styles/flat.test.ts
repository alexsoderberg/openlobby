import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cssRules, declarations, stylesheet } from "../test/cssTokens";

// The flat look (ADR 0028 sections 16.5 and 16.6): radius only through the two tokens; no shadow, glass or blended
// gradient, in global.css or in the ui/ class lists.
const css = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");

const uiDir = join(import.meta.dirname, "../ui");
const uiSources = readdirSync(uiDir)
  .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
  .map(
    (file) =>
      [
        file,
        readFileSync(join(uiDir, file), "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, ""),
      ] as const,
  );

const RADIUS_TOKEN = /^var\(--radius(-sm)?\)$/;
/** Layers that follow the radius of the box they cover (ADR 0028 section 16.11 item 3). */
const LAYER = /::(before|after)\b|\.genre-frame__cover\b/;

const radii = cssRules.flatMap(({ selector, body }) =>
  Array.from(
    body.matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;]+);/g),
    ([, value]) => ({ selector, value: value.trim() }),
  ),
);

describe("flat look", () => {
  // The parser must see every declaration, also those beside a nested @supports.
  it("finds every border-radius declaration of global.css", () => {
    const raw = css.match(/border(?:-[a-z]+)*-radius\s*:/g) ?? [];
    expect(raw.length).toBeGreaterThan(0);
    expect(radii).toHaveLength(raw.length);
  });

  it("sets every border-radius in global.css to a radius token", () => {
    expect(
      radii.filter(
        ({ selector, value }) =>
          !RADIUS_TOKEN.test(value) &&
          !(value === "inherit" && LAYER.test(selector)),
      ),
    ).toEqual([]);
  });

  it("inherits the radius only on a layer", () => {
    const inheriting = radii.filter(({ value }) => value === "inherit");
    expect(inheriting.length).toBeGreaterThan(0);
    for (const { selector } of inheriting) expect(selector).toMatch(LAYER);
  });

  it.each([
    ["box-shadow", /box-shadow\s*:/],
    ["text-shadow", /text-shadow\s*:/],
    ["drop-shadow", /drop-shadow\(/],
    ["backdrop-filter", /backdrop-filter\s*:/],
    // Ruled lines may use a repeating gradient with hard stops (section 16.6, a permanent exception); a blend may not.
    ["a blended gradient", /(?<!repeating-)(linear|radial|conic)-gradient\(/],
  ])("global.css has no %s", (_, pattern) => {
    expect(css).not.toMatch(pattern);
  });

  it("defines the two radius tokens and no other radius, shadow or glass token", () => {
    expect(
      Array.from(declarations.keys()).filter((name) =>
        /^--(radius|shadow|blur)/.test(name),
      ),
    ).toEqual(["--radius", "--radius-sm"]);
  });

  // A phone sheet drops its bottom corners with the zero space token (section 16.5: its top corners only).
  it.each(uiSources)(
    "ui/%s rounds only with a radius token and has no shadow, blur or gradient class",
    (_, source) => {
      const rounded = source.match(/\S*\brounded[\w-]*(\([^)]*\))?/g) ?? [];
      expect(
        rounded.filter(
          (name) =>
            !/rounded(-[a-z]+)?-\((--radius(-sm)?|--space-0)\)$/.test(name),
        ),
      ).toEqual([]);
      expect(source).not.toMatch(
        /\b(shadow|drop-shadow|blur|backdrop-blur|bg-gradient|bg-linear|bg-radial)(-|\b)/,
      );
    },
  );
});
