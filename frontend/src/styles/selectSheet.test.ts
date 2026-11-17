import { describe, expect, it } from "vitest";
import { cssRules as rules, declarations, stylesheet } from "../test/cssTokens";

// ADR 0027 point 4: the phone sheet needs one forced override of the inline styles Radix writes on its wrapper.
// Any other !important would win over every rule of the app, so the allowed places are pinned here.

const PHONE = "@media (width < 47.5rem), (pointer: coarse)";
const zIndexOf = (selector: string) =>
  Number(
    /z-index:\s*(\d+)/.exec(
      rules.find((rule) => rule.selector === selector)?.body ?? "",
    )?.[1],
  );

describe("dropdown list sheet (ADR 0027 point 4)", () => {
  it("uses !important only in the reduced-motion block and the sheet's wrapper override", () => {
    const forced = rules
      .filter(({ body }) => body.includes("!important"))
      .map(({ selector, scopes, body }) => ({
        selector,
        scopes,
        declarations: Array.from(
          body.matchAll(/([\w-]+):\s*([^;]+?)\s*!important/g),
          ([, property, value]) => `${property}: ${value}`,
        ),
      }));

    expect(forced).toEqual([
      {
        selector:
          '[data-radix-popper-content-wrapper]:has(> [data-slot="select-content"])',
        scopes: [PHONE],
        declarations: ["transform: none", "will-change: auto"],
      },
      {
        selector: "*, *::before, *::after",
        scopes: ["@media (prefers-reduced-motion: reduce)"],
        declarations: [
          "transition: none",
          "animation: none",
          "scroll-behavior: auto",
        ],
      },
    ]);
  });

  it("defines the phone variant on the same media list as the override", () => {
    expect(stylesheet.replace(/\s+/g, " ")).toContain(
      `@custom-variant phone { ${PHONE} { @slot; } }`,
    );
  });

  it("puts the sheet above the tab bar and the floating +, below the toaster", () => {
    const sheet = Number(declarations.get("--z-dropdown-list"));
    expect(zIndexOf(".tab-bar")).toBe(60);
    expect(zIndexOf(".plus-button--fab")).toBe(55);
    expect(sheet).toBeGreaterThan(zIndexOf(".tab-bar"));
    expect(sheet).toBeGreaterThan(zIndexOf(".plus-button--fab"));
    expect(sheet).toBeLessThan(1000);
  });
});
