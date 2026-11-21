import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cssRules } from "../test/cssTokens";

// The Orange rule (ADR 0028 section 16.4): --color-signal is used for a closed list of things and nothing else.
const SIGNAL = /var\(--color-signal\)/;
const AS_COLOUR = /(^|[;\s])color:\s*var\(--color-signal\)/;

// The rules of global.css that may fill with signal, by the item of the list they serve. Item 7 (my avatar in a
// player list) is not built yet.
const FILLS = new Set([
  // 1. The Top bar, at every width.
  ".top-bar",
  // 2. The header "+" and the floating "+" are primary actions.
  ".plus-button",
  // 3. The Now line.
  ".time-grid__now",
  ".time-grid__now::before",
  // 5. The active item of the phone Tab bar.
  '.tab[aria-current="page"]',
]);

// The rules that may set signal as `color`. Item 4 (the Next up band, the only signal text) comes with PR2; item 6
// is an icon, not text: the check icon of a full role slot.
const COLOURS = new Set([".badge--full > .role-slot-check"]);

const body = (selector: string) => {
  const found = cssRules.filter((rule) => rule.selector === selector);
  if (found.length === 0) throw new Error(`No rule for ${selector}`);
  return found.map((rule) => rule.body).join(" ");
};

const uiDir = join(import.meta.dirname, "../ui");
const uiSources = readdirSync(uiDir)
  .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
  .map((file) => [file, readFileSync(join(uiDir, file), "utf8")] as const);

describe("Orange rule", () => {
  it("uses signal in global.css only in the rules of the list", () => {
    const users = cssRules
      .filter(({ body }) => SIGNAL.test(body))
      .map(({ selector }) => selector);
    expect(users.length).toBeGreaterThan(0);
    expect(
      users.filter(
        (selector) => !FILLS.has(selector) && !COLOURS.has(selector),
      ),
    ).toEqual([]);
  });

  it("sets signal as a colour only for the icon of a full role slot", () => {
    expect(
      cssRules
        .filter(({ body }) => AS_COLOUR.test(body))
        .map(({ selector }) => selector),
    ).toEqual([...COLOURS]);
  });

  // 2. The primary button: a signal fill and edge with on-signal text. No other ui/ class list names signal, so the
  // Dropdown list has none (section 16.4).
  it("uses signal in ui/ only for the primary button, with on-signal text", () => {
    const users = uiSources.filter(([, source]) =>
      source.includes("--color-signal"),
    );
    expect(users.map(([file]) => file)).toEqual(["Button.tsx"]);
    expect(users[0][1]).toMatch(
      /primary:\s*"border-\(--color-signal\) bg-\(--color-signal\) text-\(--color-on-signal\)"/,
    );
    expect(users[0][1].match(/--color-signal/g)).toHaveLength(2);
  });

  it("keeps signal out of the Dropdown list rules", () => {
    expect(
      cssRules.filter(
        ({ selector, body }) =>
          selector.includes("select-") && SIGNAL.test(body),
      ),
    ).toEqual([]);
  });

  it.each([".top-bar", ".plus-button", '.tab[aria-current="page"]'])(
    "puts on-signal text on the signal fill of %s",
    (selector) => {
      expect(body(selector)).toMatch(
        /(^|[;\s])color:\s*var\(--color-on-signal\)/,
      );
    },
  );

  it("keeps the count of a full role slot in the text colour", () => {
    expect(body(".badge")).toMatch(/(^|[;\s])color:\s*var\(--color-text\)/);
    expect(cssRules.some(({ selector }) => selector === ".badge--full")).toBe(
      false,
    );
  });

  it("draws the focus ring in the text colour, 2px with a 2px offset", () => {
    expect(body(":focus-visible")).toMatch(
      /outline:\s*var\(--width-edge\) solid var\(--color-text\);\s*outline-offset:\s*2px/,
    );
  });

  // The text colour is under 3:1 on signal, so the one signal surface with focusable items takes on-signal.
  it("draws the focus ring on the Top bar in on-signal", () => {
    expect(body(".top-bar :focus-visible")).toMatch(
      /outline-color:\s*var\(--color-on-signal\)/,
    );
  });

  it("checks checkboxes and radios in the text colour", () => {
    const accents = cssRules.flatMap(({ body }) =>
      Array.from(
        body.matchAll(/accent-color:\s*([^;]+);/g),
        ([, value]) => value,
      ),
    );
    expect(accents.length).toBeGreaterThan(0);
    expect(new Set(accents)).toEqual(new Set(["var(--color-text)"]));
  });

  it.each([".badge", ".next-up__figure", ".invite-link__uses"])(
    "%s shows its count in tabular figures, without signal",
    (selector) => {
      expect(body(selector)).toMatch(/font-variant-numeric:\s*tabular-nums/);
      expect(body(selector)).not.toMatch(SIGNAL);
    },
  );
});
