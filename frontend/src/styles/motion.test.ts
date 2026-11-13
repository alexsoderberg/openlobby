import { describe, expect, it } from "vitest";
import { stylesheet } from "../test/cssTokens";

// The compositor runs transform and opacity off the main thread; anything else repaints every frame.
// visibility is a discrete switch (the create popover's delayed hide), so it never repaints mid-way.
const COMPOSITED = new Set(["transform", "opacity", "visibility", "none"]);

// A field's border repaints one small box for 0.1 s, and inputs cannot host a fading layer, so it stays.
const ALLOWED = new Set([
  `.group-form :is(input, select):where(:not([type="radio"], [type="checkbox"])), .invite-link__url border-color`,
]);

/** Each rule as [selector, declarations]; at-rule wrappers fall away because only innermost blocks match. */
const rules = Array.from(
  stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g),
  ([, selector, body]) =>
    [
      selector
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\s+/g, " ")
        .trim(),
      body,
    ] as const,
);

/** "selector property" for each transitioned property; items split on commas outside parentheses only. */
const transitions = rules.flatMap(([selector, body]) =>
  Array.from(
    body.matchAll(/transition(?:-property)?:\s*([^;]+);/g),
    ([, value]) =>
      value
        .split(/,(?![^(]*\))/)
        .map((item) => `${selector} ${item.trim().split(/\s+/)[0]}`),
  ).flat(),
);

const keyframeProperties = Array.from(
  stylesheet.matchAll(/@keyframes[^{]+\{((?:[^{}]*\{[^}]*\})*)\s*\}/g),
  ([, frames]) =>
    Array.from(frames.matchAll(/([\w-]+)\s*:/g), ([, property]) => property),
).flat();

describe("motion cost", () => {
  it("transitions only composited properties, never all", () => {
    expect(transitions).toContain(".panel opacity");
    const costly = transitions.filter(
      (entry) =>
        !COMPOSITED.has(entry.split(" ").at(-1) ?? "") && !ALLOWED.has(entry),
    );
    expect(costly).toEqual([]);
  });

  it("animates only composited properties in keyframes", () => {
    expect(keyframeProperties).toContain("opacity");
    expect(keyframeProperties.filter((p) => !COMPOSITED.has(p))).toEqual([]);
  });

  // A blur must be recomputed every frame its element or anything around it moves. Panels reveal and ride
  // the page transition, so only the sticky top bar, which stays put, keeps one.
  it("keeps backdrop-filter on the top bar only", () => {
    const blurred = rules
      .filter(([, body]) => /backdrop-filter\s*:/.test(body))
      .map(([selector]) => selector);
    expect(blurred).toEqual([".topbar::before"]);
  });
});
