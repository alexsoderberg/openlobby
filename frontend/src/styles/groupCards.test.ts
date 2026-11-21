import { describe, expect, it } from "vitest";
import { stylesheet, token } from "../test/cssTokens";

/** The declarations of the first rule with exactly this selector. */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|[}/])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(
    stylesheet,
  );
  if (!match) throw new Error(`No rule for ${selector}`);
  return match[1].replace(/\s+/g, " ");
}

const TWO_COLUMNS =
  /@media \(min-width: 47\.5rem\)\s*\{\s*\.group-cards\s*\{([^}]*)\}/;
const REDUCED_MOTION_ALL =
  /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*,\s*\*::before,\s*\*::after\s*\{([^}]*)\}/;

// jsdom does no layout, so these read the Group list rules of REQ-0024 and REQ-0025 from the stylesheet.
describe("Group list cards", () => {
  it("form one column on phones and two from 760px", () => {
    expect(rule(".group-cards")).toMatch(
      /grid-template-columns: minmax\(0, 1fr\);/,
    );
    expect(TWO_COLUMNS.exec(stylesheet)?.[1]).toMatch(
      /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/,
    );
  });

  it("make each card link at least the 44px tap size", () => {
    expect(rule(".group-card")).toMatch(/min-height: var\(--size-tap\);/);
    expect(token("--size-tap")).toBe("2.75rem");
  });

  it("keep the global focus ring on the card link", () => {
    expect(stylesheet).not.toMatch(
      /\.group-card[^{]*:focus[^{]*\{[^}]*outline:\s*none/,
    );
  });

  it("fade up on appearing with a keyframe of opacity and transform only (signature: groups)", () => {
    expect(rule(".group-cards > li")).toMatch(
      /animation: page-in var\(--duration-page\) var\(--ease-out\) both;/,
    );
    const frames = /@keyframes page-in\s*\{([\s\S]*?)\}\s*\}/.exec(
      stylesheet,
    )?.[1];
    const properties = Array.from(
      frames?.matchAll(/([\w-]+)\s*:/g) ?? [],
      ([, property]) => property,
    );
    expect(properties.sort()).toEqual(["opacity", "transform"]);
    expect(REDUCED_MOTION_ALL.exec(stylesheet)?.[1]).toMatch(
      /animation:\s*none !important;/,
    );
  });

  // Colour changes on hover are instant (ADR 0028 section 2).
  it("show their hover at once, and move not at all under reduced motion", () => {
    expect(rule(".group-card::after")).not.toMatch(/transition/);
    expect(REDUCED_MOTION_ALL.exec(stylesheet)?.[1]).toMatch(
      /transition:\s*none !important;/,
    );
  });
});
