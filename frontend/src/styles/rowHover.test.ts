import { describe, expect, it } from "vitest";
import { cssRules } from "../test/cssTokens";

const FINE_POINTER = "@media (hover: hover) and (pointer: fine)";

// No hover on whole sections: only a row that is one link (a lobby row) is tinted, and only under a mouse.
describe("list row hover", () => {
  const hoverRules = cssRules.filter(({ selector }) =>
    /\.row-list > [^,]*:hover::after/.test(selector),
  );

  it("tints lobby rows only, on fine pointers only", () => {
    expect(
      hoverRules.map(({ selector, scopes }) => [selector, scopes]),
    ).toEqual([[".row-list > .lobby-row:hover::after", [FINE_POINTER]]]);
  });

  it("draws the tint layer on lobby rows only", () => {
    const layers = cssRules
      .filter(({ selector }) => /^\.row-list > \.[\w-]+::after$/.test(selector))
      .map(({ selector }) => selector);
    expect(layers).toEqual([".row-list > .lobby-row::after"]);
  });
});
