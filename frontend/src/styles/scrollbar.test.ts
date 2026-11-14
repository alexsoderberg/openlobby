import { describe, expect, it } from "vitest";
import {
  WCAG_AA_UI,
  contrastRatio,
  overPage,
  solid,
  stylesheet,
} from "../test/cssTokens";

type Rule = { selector: string; body: string; scopes: string[] };

/** Each innermost rule with the at-rule preludes around it, outermost first. */
const rules: Rule[] = [];
{
  const scopes: string[] = [];
  let text = "";
  for (const char of stylesheet.replace(/\/\*[\s\S]*?\*\//g, "")) {
    if (char === "{") {
      scopes.push(text.trim());
      text = "";
    } else if (char === "}") {
      const selector = scopes.pop() ?? "";
      if (!selector.startsWith("@"))
        rules.push({ selector, body: text, scopes: [...scopes] });
      text = "";
    } else text += char;
  }
}

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

  it.each([
    ["the page", solid("--color-bg")],
    ["a panel", overPage("--color-surface")],
    ["the popover card", solid("--color-popover-top")],
  ])("the thumb stands out at 3:1 or more on %s", (_, plate) => {
    expect(
      contrastRatio(solid("--color-scrollbar-thumb"), plate),
    ).toBeGreaterThanOrEqual(WCAG_AA_UI);
  });
});
