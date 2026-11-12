import { describe, expect, it } from "vitest";
import { stylesheet, token } from "../test/cssTokens";

/** Whitespace squashed, so a rule reads the same however Prettier wraps it. */
const squash = (css: string) =>
  css.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")");

/** The text inside every `@media <query>` block, joined. */
function mediaText(query: string): string {
  let text = "";
  for (let at = stylesheet.indexOf(query); at !== -1;) {
    let index = stylesheet.indexOf("{", at);
    const start = index + 1;
    for (let depth = 0; ; index++) {
      if (stylesheet[index] === "{") depth++;
      if (stylesheet[index] === "}" && --depth === 0) break;
    }
    text += stylesheet.slice(start, index);
    at = stylesheet.indexOf(query, index);
  }
  return text;
}

/** The declarations of the first rule with exactly this selector in `css`, whitespace squashed. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|[}/])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(
    css,
  );
  if (!match) throw new Error(`No rule for ${selector}`);
  return squash(match[1]);
}

const WIDE = "@media (min-width: 47.5rem)";
const PHONE = "@media (max-width: 47.499rem)";
const GRID_HEIGHT = "var(--grid-height, var(--size-grid-height))";

// jsdom does no layout and cannot clamp a scroll, so these read the rules of REQ-0019 from the stylesheet.
describe("week time grid layout", () => {
  it("is 32rem tall on phones", () => {
    expect(token("--size-grid-height")).toBe("32rem");
    expect(rule(stylesheet, ".time-grid")).toContain(`height: ${GRID_HEIGHT};`);
  });

  it("reaches the window bottom on wide screens, never shorter than on phones", () => {
    expect(rule(mediaText(WIDE), ".time-grid")).toContain(
      "--grid-height: max(var(--size-grid-height), calc(100dvh - var(--grid-top, 0px) - var(--space-4)));",
    );
  });

  it("has room below 24:00, so the last hour can scroll to the top", () => {
    const end = rule(stylesheet, ".time-grid__days::after");
    expect(end).toContain("grid-column: 1 / -1;");
    expect(end).toContain(
      `height: calc(${GRID_HEIGHT} - var(--size-grid-title) - var(--size-hour));`,
    );
  });

  it("is as wide as the main area: at most 72rem and centred, with the members panel below it", () => {
    expect(token("--width-app")).toBe("72rem");
    const main = rule(stylesheet, ".shell__main");
    expect(main).toContain("max-width: var(--width-app);");
    expect(main).toContain("margin: 0 auto;");
    expect(
      rule(
        mediaText("@media (min-width: 75rem)"),
        ".panel-group--aside:has(.time-grid)",
      ),
    ).toContain("grid-template-columns: minmax(0, 1fr);");
  });

  it("shows one day on phones and switches at 760px", () => {
    expect(
      rule(mediaText(PHONE), ".time-grid__day:not([data-selected])"),
    ).toContain("display: none;");
    expect(rule(mediaText(WIDE), ".day-pills")).toContain("display: none;");
  });

  it("lets the pointer through the Now line", () => {
    expect(rule(stylesheet, ".time-grid__now")).toContain(
      "pointer-events: none;",
    );
  });
});
