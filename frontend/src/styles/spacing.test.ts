import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { token } from "../test/cssTokens";

const stylesheet = readFileSync(
  join(import.meta.dirname, "global.css"),
  "utf8",
);

/** The declarations of the first rule whose selector list contains `selector`. */
function declarationsFor(selector: string): string {
  const rule = new RegExp(String.raw`[^}]*${selector}[^{]*\{([^}]*)\}`).exec(
    stylesheet,
  );
  return rule?.[1] ?? "";
}

describe("Next up card spacing", () => {
  // The card is no .panel, so what follows the figure or the meter (button, Ended, alert) needs its own gap.
  it.each([
    String.raw`\.next-up__spots > \.meter \+ \*`,
    String.raw`\.next-up__spots > \.next-up__figure \+ \*`,
  ])("spaces what follows %s by space-3", (selector) => {
    expect(declarationsFor(selector)).toMatch(/margin-top:\s*var\(--space-3\)/);
  });
});

describe("Panel button rows", () => {
  // In the Lobbies panel the view switch follows an empty p.status line, which has no margin, so it needs the rule's gap.
  it("spaces the view switch from the content above by space-3", () => {
    expect(declarationsFor(String.raw`\.view-switch\s*\)`)).toMatch(
      /margin-top:\s*var\(--space-3\)/,
    );
  });
});

describe("Settings rows (REQ-0020)", () => {
  // The Game list row gets its tap height and focus ring from these shared rules, not from rules of its own.
  it("makes a list row at least the 44px tap size", () => {
    expect(declarationsFor(String.raw`\.list-row`)).toMatch(
      /min-height:\s*var\(--size-tap\)/,
    );
    expect(token("--size-tap")).toBe("2.75rem");
  });

  it("draws a visible outline on every keyboard focus", () => {
    const rule = /(?:^|\})\s*:focus-visible\s*\{([^}]*)\}/.exec(stylesheet);
    expect(rule?.[1]).toMatch(/outline:\s*3px solid var\(--color-focus\)/);
  });
});
