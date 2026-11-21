import { describe, expect, it } from "vitest";
import {
  WCAG_AA_UI,
  contrastRatio,
  cssRules as rules,
  solid,
} from "../test/cssTokens";

const standardRules = rules.filter(({ body }) =>
  /scrollbar-color\s*:|scrollbar-width:\s*thin/.test(body),
);
const webkitRules = rules.filter(({ selector }) =>
  selector.includes("::-webkit-scrollbar"),
);

describe("scrollbars", () => {
  it("styles the page with the standard properties", () => {
    expect(standardRules.map(({ selector }) => selector).sort()).toEqual([
      "*",
      ":root",
      '[data-slot="select-content"] [data-radix-select-viewport]',
    ]);
    expect(webkitRules.length).toBeGreaterThan(0);
  });

  it.each([
    ["standard", standardRules, "@supports (scrollbar-color: auto)"],
    ["WebKit", webkitRules, "@supports not (scrollbar-color: auto)"],
  ])(
    "scopes the %s rules to a mouse and their engine",
    (_, scoped, supports) => {
      for (const { selector, scopes } of scoped) {
        expect(scopes, selector).toEqual(["@media (pointer: fine)", supports]);
      }
    },
  );

  it("uses only tokens or transparent for colours and sizes", () => {
    for (const { body } of [...standardRules, ...webkitRules]) {
      for (const [, name, value] of body.matchAll(/([\w-]+):\s*([^;]+);/g)) {
        const rest = value.replace(/var\(--[\w-]+\)/g, "").trim();
        expect(rest, `${name}: ${value}`).toMatch(/^(transparent|thin)?$/);
      }
    }
  });

  // The thumb colours the CSS really uses: the first value of scrollbar-color and the WebKit thumb's background.
  const thumbs = [
    ...standardRules.flatMap(({ body }) =>
      Array.from(
        body.matchAll(/scrollbar-color:\s*var\((--[\w-]+)\)/g),
        ([, name]) => name,
      ),
    ),
    ...webkitRules
      .filter(({ selector }) => selector.includes("thumb"))
      .flatMap(({ body }) =>
        Array.from(
          body.matchAll(/background:\s*var\((--[\w-]+)\)/g),
          ([, name]) => name,
        ),
      ),
  ];

  it("finds the thumb colour of both engines", () => {
    expect(thumbs).toHaveLength(2);
  });

  it.each([
    ["the page", "--color-ground"],
    ["a panel", "--color-surface"],
    ["a hovered row", "--color-raised"],
  ])("the thumb stands out at 3:1 or more on %s", (_, plate) => {
    for (const thumb of thumbs)
      expect(
        contrastRatio(solid(thumb), solid(plate)),
        thumb,
      ).toBeGreaterThanOrEqual(WCAG_AA_UI);
  });
});
