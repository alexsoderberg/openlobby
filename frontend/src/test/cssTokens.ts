import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reads global.css as text: the tokens and the font rules are the contract that later screens rely on.
export const stylesheet = readFileSync(
  join(import.meta.dirname, "../styles/global.css"),
  "utf8",
);
/** One innermost rule of global.css, with the at-rule preludes around it, outermost first. */
export type CssRule = { selector: string; body: string; scopes: string[] };

/**
 * Every rule, comments removed and whitespace in selectors and preludes collapsed. A rule's body holds its own
 * declarations, also those after a nested at-rule. The declarations inside an at-rule nested in a rule (such as
 * `@supports` inside `.x { }`) are a rule of their own: the enclosing selector, with that at-rule in its scopes.
 */
export const cssRules: CssRule[] = [];
{
  const blocks: { prelude: string; body: string }[] = [];
  const isAtRule = (prelude: string) => prelude.startsWith("@");
  let text = "";
  for (const char of stylesheet.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (char === "{") {
      // What comes before the last ";" is declarations of the enclosing block; the rest is this block's prelude.
      const split = text.lastIndexOf(";") + 1;
      if (blocks.length) blocks[blocks.length - 1].body += text.slice(0, split);
      blocks.push({
        prelude: text.slice(split).replace(/\s+/g, " ").trim(),
        body: "",
      });
      text = "";
    } else if (char === "}") {
      const block = blocks.pop();
      if (!block) continue;
      block.body += text;
      text = "";
      const scopes = blocks.map(({ prelude }) => prelude).filter(isAtRule);
      const owner = [...blocks]
        .reverse()
        .find(({ prelude }) => !isAtRule(prelude));
      if (!isAtRule(block.prelude))
        cssRules.push({ selector: block.prelude, body: block.body, scopes });
      else if (owner && block.body.trim())
        cssRules.push({
          selector: owner.prelude,
          body: block.body,
          scopes: [...scopes, block.prelude],
        });
    } else text += char;
  }
}

export const publicDir = join(import.meta.dirname, "../../public");

export const WCAG_AA_TEXT = 4.5;
export const WCAG_AA_UI = 3;

const rootBlock = /:root\s*\{([^}]*)\}/.exec(stylesheet)?.[1] ?? "";
export const declarations = new Map(
  Array.from(
    rootBlock.matchAll(/(--[\w-]+):\s*([^;]+);/g),
    ([, name, value]) => [name, value.trim()],
  ),
);

/** Resolves a token, following `var(--other)` references. */
export function token(name: string): string {
  const value = declarations.get(name);
  if (value === undefined)
    throw new Error(`Token ${name} is not defined in :root`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference ? token(reference[1]) : value;
}

/** A solid #rrggbb token, as is. */
export function solid(name: string): string {
  const value = token(name);
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`${name} is not a solid hex colour`);
  return value;
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

export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
