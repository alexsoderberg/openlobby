import { describe, expect, it } from "vitest";
import { cssRules, stylesheet } from "../test/cssTokens";

// The compositor runs transform and opacity off the main thread; anything else repaints every frame.
// visibility is a discrete switch (the create popover's delayed hide), so it never repaints mid-way.
const COMPOSITED = new Set(["transform", "opacity", "visibility", "none"]);

/** "selector property" for each transitioned property; items split on commas outside parentheses only. */
const transitions = cssRules.flatMap(({ selector, body }) =>
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
    expect(transitions).toContain(".scrim opacity");
    const costly = transitions.filter(
      (entry) => !COMPOSITED.has(entry.split(" ").at(-1) ?? ""),
    );
    expect(costly).toEqual([]);
  });

  it("animates only composited properties in keyframes", () => {
    expect(keyframeProperties).toContain("opacity");
    expect(keyframeProperties.filter((p) => !COMPOSITED.has(p))).toEqual([]);
  });
});
