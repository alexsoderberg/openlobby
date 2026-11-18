import { describe, expect, it } from "vitest";
import { cssRules, stylesheet } from "../test/cssTokens";

const body = (selector: string) => {
  const found = cssRules.filter((rule) => rule.selector === selector);
  if (found.length === 0) throw new Error(`No rule for ${selector}`);
  return found.map((rule) => rule.body).join(" ");
};

const GOLD = /--color-accent/;

// Gold marks only action and state; counts and decoration are neutral (REQ-0028 item 1).
describe("gold rule", () => {
  it.each([
    ".badge",
    ".next-up__figure",
    ".invite-link__uses",
    ".group-card",
    ".initials-icon",
    ".group-card__people > .initials-icon",
    ".create-popover__card",
    ".context-menu",
    ".day-pill__dot",
    '.time-grid__title[aria-current="date"] b',
    // Hover and open tints are neutral; the focus ring stays gold (DECISION, 2026-11-18).
    ".game-chip::after",
    ".context-menu__item:hover, .context-menu__item:focus-visible",
    ".time-grid__create::before",
  ])("%s has no gold", (selector) => {
    expect(body(selector)).not.toMatch(GOLD);
  });

  it.each([".badge", ".next-up__figure", ".invite-link__uses"])(
    "%s shows its count in tabular figures",
    (selector) => {
      expect(body(selector)).toMatch(/font-variant-numeric:\s*tabular-nums/);
    },
  );

  it("fills a lobby meter with its genre accent and the invite uses meter neutrally", () => {
    expect(body(".meter > span")).toMatch(
      /background:\s*var\(--genre-accent\)/,
    );
    expect(body(".invite-link .meter > span")).toMatch(
      /background:\s*var\(--color-muted\)/,
    );
  });

  it("keeps the full role slot gold, as a state", () => {
    expect(body(".badge--full")).toMatch(/background:\s*var\(--color-accent\)/);
  });

  it("draws the logo without a gold part", () => {
    expect(stylesheet).not.toMatch(/\.brand__accent/);
  });
});
