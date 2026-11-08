import { readFileSync } from "node:fs";
import { join } from "node:path";

// Reads global.css as text: the tokens and the font rules are the contract that later screens rely on.
export const stylesheet = readFileSync(
  join(import.meta.dirname, "../styles/global.css"),
  "utf8",
);
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

/** A translucent rgba token composited over --color-bg, giving the plate the text really sits on. */
export function overPage(name: string): string {
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

export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
