import { describe, expect, it } from "vitest";
import { cssRules, declarations } from "../test/cssTokens";

// The Top bar's one nav and the header "+" change place at 760px (ADR 0028 sections 3 and 16.12).
const WIDE = "@media (min-width: 47.5rem)";

const bodyOf = (selector: string, scope?: string) =>
  cssRules
    .filter(
      (rule) =>
        rule.selector === selector &&
        (scope ? rule.scopes.includes(scope) : rule.scopes.length === 0),
    )
    .map((rule) => rule.body)
    .join(" ");

describe("Top bar", () => {
  it("hides the header plus on phones and shows it from 760px", () => {
    expect(bodyOf(".plus-button--header")).toMatch(/display:\s*none/);
    expect(bodyOf(".plus-button--header", WIDE)).toMatch(
      /display:\s*inline-grid/,
    );
  });

  it("fixes the nav to the bottom on phones and puts it back in the bar from 760px", () => {
    const phone = bodyOf(".tab-bar");
    expect(phone).toMatch(/position:\s*fixed/);
    expect(phone).toMatch(/bottom:\s*0/);
    const wide = bodyOf(".tab-bar", WIDE);
    expect(wide).toMatch(/position:\s*static/);
    expect(wide).toMatch(/inset:\s*auto/);
    expect(wide).toMatch(/z-index:\s*auto/);
  });

  it("reserves the active tab's weight in every label with a hidden copy that screen readers skip", () => {
    const copy = bodyOf(".tab__label::after");
    expect(copy).toMatch(/content:\s*attr\(data-label\)\s*\/\s*""/);
    expect(copy).toMatch(/visibility:\s*hidden/);
    expect(copy).toMatch(/height:\s*0/);
    const weight = "font-weight: var(--font-weight-tab-active)";
    expect(copy).toContain(weight);
    expect(bodyOf('.tab[aria-current="page"]', WIDE)).toContain(weight);
    expect(Number(declarations.get("--font-weight-tab-active"))).toBe(700);
  });
});
