import { describe, expect, it } from "vitest";
import { cssRules, token } from "../test/cssTokens";

const WIDE = "@media (min-width: 47.5rem)";
const FINE_POINTER = "@media (hover: hover) and (pointer: fine)";

/** The declarations of the rules with exactly this selector, at the top level or inside `scope`, joined. */
function body(selector: string, scope?: string): string {
  const found = cssRules.filter(
    (rule) =>
      rule.selector === selector &&
      (scope ? rule.scopes.includes(scope) : rule.scopes.length === 0),
  );
  if (found.length === 0) throw new Error(`No rule for ${selector}`);
  return found
    .map((rule) => rule.body)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")");
}

// jsdom does no layout, so these read the rules of ADR 0028 section 4 from the stylesheet.
describe("running order layout", () => {
  it("is the scroll container itself, so the page never scrolls sideways", () => {
    const scroll = body(".running-order__scroll");
    expect(scroll).toContain("overflow-x: auto;");
    expect(scroll).toContain("container-type: inline-size;");
  });

  it("shows about 16 hours beside the day names on wide screens, never less than 4.5rem an hour", () => {
    expect(token("--running-order-wide-hours")).toBe("16");
    expect(token("--size-running-order-hour-min")).toBe("4.5rem");
    const week = body(".running-order__week", WIDE);
    expect(week).toContain(
      "width: calc(var(--size-running-order-label) + (100cqi - var(--size-running-order-label)) * 24 / var(--running-order-wide-hours));",
    );
    expect(week).toContain(
      "min-width: calc(var(--size-running-order-label) + 24 * var(--size-running-order-hour-min));",
    );
    expect(
      body(".running-order__hours, .running-order__track", WIDE),
    ).toContain("flex: 1 1 0;");
  });

  it("shows about 6 hours at once on phones, the rest by scrolling inside it", () => {
    expect(token("--running-order-phone-hours")).toBe("6");
    expect(body(".running-order__week")).toContain(
      "width: calc(100cqi * 24 / var(--running-order-phone-hours));",
    );
  });

  it("keeps the day names and the phone rows at the left while the axis scrolls", () => {
    for (const selector of [
      ".running-order__name",
      ".running-order__lobbies",
      ".running-order__day[data-empty]",
    ]) {
      expect(body(selector)).toContain("position: sticky;");
      expect(body(selector)).toContain("width: 100cqi;");
    }
  });

  it("places a block at its start and length, in its lane", () => {
    const block = body(".running-order__block", WIDE);
    expect(block).toContain("left: calc(var(--from, 0) * 100%);");
    expect(block).toContain(
      "width: max(calc(var(--length, 0) * 100%), var(--size-block-min));",
    );
    expect(block).toContain(
      "top: calc(var(--lane, 0) * var(--size-lane) + var(--space-1));",
    );
    expect(body(".running-order__track", WIDE)).toContain(
      "min-height: calc(var(--lanes, 1) * var(--size-lane));",
    );
  });

  it("puts the create area over the future time only, under the blocks, with a hover tint for a mouse only", () => {
    expect(body(".running-order__create")).toContain(
      "left: calc(var(--from, 0) * 100%);",
    );
    expect(body(".running-order__create", WIDE)).toContain("bottom: 0;");
    expect(
      body(".running-order__create:hover::before", FINE_POINTER),
    ).toContain("opacity: 1;");
    expect(() => body(".running-order__create:hover::before")).toThrow();
    // On phones the bars over it take their own clicks, so a booked time opens nothing.
    expect(body(".running-order__bar")).toContain("pointer-events: auto;");
  });

  it("marks my own block with a text-colour outline set inside it (ADR 0028 section 16.7)", () => {
    expect(
      body(".running-order__block[data-mine] > a:not(:focus-visible)", WIDE),
    ).toContain(
      "outline: var(--width-edge) solid var(--color-text); outline-offset: calc(-1 * var(--width-edge));",
    );
  });

  it("draws the Now line as 2px signal over a 4px ground bar, and lets the pointer through", () => {
    expect(token("--width-marker")).toBe("4px");
    expect(token("--width-edge")).toBe("2px");
    expect(body(".running-order__now")).toContain(
      "width: var(--width-marker);",
    );
    expect(body(".running-order__now")).toContain(
      "background: var(--color-ground);",
    );
    expect(body(".running-order__now::before")).toContain(
      "inset: 0 calc((var(--width-marker) - var(--width-edge)) / 2);",
    );
    expect(body(".running-order__bars")).toContain("pointer-events: none;");
  });

  it("puts on-group text on every group fill", () => {
    expect(body(".running-order__block > a", WIDE)).toContain(
      "color: var(--color-on-group);",
    );
    expect(body(".running-order__spots")).toContain(
      "color: var(--color-on-group);",
    );
    for (let index = 1; index <= 6; index++)
      expect(body(`[data-group-color="${index}"]`)).toBe(
        ` --group-color: var(--color-group-${index}); `,
      );
  });

  it("takes every weight and line height of Home's rules from a token", () => {
    const home = cssRules.filter(({ selector }) =>
      /(^|[\s,])\.(running-order|next-up-band|group-legend|empty-state__title)/.test(
        selector,
      ),
    );
    expect(home.length).toBeGreaterThan(0);
    for (const { selector, body } of home) {
      expect(`${selector} { ${body} }`).not.toMatch(
        /(font-weight|line-height):\s*[\d.]/,
      );
    }
  });
});
