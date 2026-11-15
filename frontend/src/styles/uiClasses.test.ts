import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { declarations, stylesheet } from "../test/cssTokens";

// ADR 0023 point 2: the class lists in ui/ are Tailwind utilities that read the design tokens. A class that
// Tailwind cannot build, or a token that is not defined, renders nothing and fails silently, hence this test.
const uiDir = join(import.meta.dirname, "../ui");
const sources = readdirSync(uiDir, { recursive: true, encoding: "utf8" })
  .filter((file) => file.endsWith(".tsx"))
  .map((file) =>
    readFileSync(join(uiDir, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, ""),
  );

const CLOSING: Record<string, string> = { "{": "}", "(": ")" };

/** The expression after `start`: one string literal, or a balanced {...} or (...) block. */
function expressionAt(source: string, start: number): string {
  const open = source[start];
  if (open === '"')
    return source.slice(start, source.indexOf('"', start + 1) + 1);
  let depth = 0;
  for (let end = start; end < source.length; end++) {
    if (source[end] === open) depth++;
    if (source[end] === CLOSING[open] && --depth === 0)
      return source.slice(start, end + 1);
  }
  return "";
}

// Class lists sit in className attributes, classNames(...) calls and shadcn's `<name>Variants` objects.
const classes = sources.flatMap((source) =>
  Array.from(
    source.matchAll(/className=|classNames(?=\()|const \w+Variants = /g),
    (match) => expressionAt(source, match.index + match[0].length),
  )
    .flatMap((expression) =>
      Array.from(expression.matchAll(/"([^"]*)"|`([^`]*)`/g)),
    )
    .flatMap(([, quoted, template]) =>
      (quoted ?? template).replace(/\$\{[^}]*\}/g, " ").split(/\s+/),
    )
    .filter(Boolean),
);

const FORBIDDEN = [
  "-[",
  "dark:",
  "ring",
  "shadow",
  "transition",
  "duration-",
  "ease-",
  "animate-",
  "font-",
  "leading-",
  "tracking-",
];
/** Colour and radius utilities, after their variants (`hover:`, `pointer-coarse:`). */
const COLOUR_OR_RADIUS =
  /^(bg|text|border|outline|decoration|accent|caret|fill|stroke|divide|from|via|to)-|^rounded(-|$)/;
// The only exception to the token rule (ADR 0023, B2 amendment c): these name the absence of a colour.
const NO_COLOUR = /^(bg|border)-transparent$/;
/** A class without its variants. */
const utility = (name: string) => name.split(":").at(-1) ?? name;
/** Tailwind's text sizes; size and weight live under [data-slot] in global.css (ADR 0023, B2 amendment g). */
const TEXT_SIZE = /^text-(xs|sm|base|lg|xl|\d+xl)$/;
const TOKEN = /\((?:[\w-]+:)?(--[\w-]+)\)/g;
/** The plain words that global.css keeps from being built (ADR 0023, Amendment 2026-11-15 a). */
const excludedWords = (
  /@source not inline\("([^"]*)"\)/.exec(stylesheet)?.[1] ?? ""
).split(" ");

describe("ui/ class lists (ADR 0023 point 2)", () => {
  it("finds the class lists", () => {
    expect(classes).toContain("bg-(--color-accent)");
  });

  it("uses no arbitrary value, dark variant, ring, shadow, motion or typography class", () => {
    expect(
      classes.filter((name) => FORBIDDEN.some((part) => name.includes(part))),
    ).toEqual([]);
  });

  it("uses no text size class", () => {
    expect(classes.filter((name) => TEXT_SIZE.test(utility(name)))).toEqual([]);
  });

  it("names a token in every colour and radius class", () => {
    expect(
      classes.filter(
        (name) =>
          COLOUR_OR_RADIUS.test(utility(name)) &&
          !name.includes("(--") &&
          !NO_COLOUR.test(utility(name)),
      ),
    ).toEqual([]);
  });

  it("uses only tokens defined in :root of global.css", () => {
    const tokens = classes.flatMap((name) =>
      Array.from(name.matchAll(TOKEN), ([, token]) => token),
    );
    expect(tokens.filter((token) => !declarations.has(token))).toEqual([]);
  });

  it("uses no plain word that global.css keeps from being built", () => {
    expect(excludedWords).toContain("hidden");
    expect(classes.filter((name) => excludedWords.includes(name))).toEqual([]);
  });
});
