import { describe, expect, it } from "vitest";
import { cssRules, declarations, stylesheet } from "../test/cssTokens";
// Imported for its side effect: sonner puts its stylesheet, with the toaster's z-index, into the document head.
import "../ui/Toast";

// ADR 0023 point 4 (Amendment 2026-11-17): every overlay is a portal with a z-index token below 1000, so the
// toaster (sonner's own z-index) stays above them all.
const TOASTER_FLOOR = 1000;
const TAB_BAR = 60;

describe("z-index layers", () => {
  it("keeps every z-index value in global.css below the toaster", () => {
    const values = Array.from(
      stylesheet.matchAll(/(?:z-index|--z-[\w-]+):\s*(-?\d+)/g),
      ([, value]) => Number(value),
    );
    expect(values.length).toBeGreaterThan(0);
    expect(values.filter((value) => value >= TOASTER_FLOOR)).toEqual([]);
  });

  it("puts the popover above the tab bar and below the dropdown list", () => {
    const popover = Number(declarations.get("--z-popover"));
    expect(popover).toBeGreaterThan(TAB_BAR);
    expect(popover).toBeLessThan(Number(declarations.get("--z-dropdown-list")));
    expect(popover).toBeLessThan(TOASTER_FLOOR);
  });

  // ADR 0023 Amendment 2026-11-19: the dialog covers every other overlay, as the native modal did; toasts stay above.
  it("puts the dialog above the tab bar, the popover and the dropdown list, below the toaster", () => {
    const dialog = Number(declarations.get("--z-dialog"));
    for (const below of [
      TAB_BAR,
      Number(declarations.get("--z-popover")),
      Number(declarations.get("--z-dropdown-list")),
    ])
      expect(dialog).toBeGreaterThan(below);
    expect(dialog).toBeLessThan(TOASTER_FLOOR);
  });

  // ADR 0028 section 16.12 item 2: a sticky layered header would cap the Tab bar inside it, so only the wide
  // Top bar is sticky, at its token below the scrim; on phones it has neither and the Tab bar keeps its layer.
  it("makes the Top bar sticky and layered from 760px only, below the scrim and the tab bar", () => {
    const topBar = cssRules.filter((rule) => rule.selector === ".top-bar");
    const phone = topBar.filter((rule) => rule.scopes.length === 0);
    const wide = topBar.filter((rule) =>
      rule.scopes.includes("@media (min-width: 47.5rem)"),
    );
    expect(phone.length).toBeGreaterThan(0);
    for (const { body } of phone) expect(body).not.toMatch(/position|z-index/);
    const wideBody = wide.map((rule) => rule.body).join(" ");
    expect(wideBody).toContain("position: sticky");
    expect(wideBody).toContain("z-index: var(--z-top-bar)");
    const topBarLayer = Number(declarations.get("--z-top-bar"));
    const scrim = cssRules.find((rule) => rule.selector === ".scrim")?.body;
    expect(topBarLayer).toBeLessThan(
      Number(/z-index:\s*(\d+)/.exec(scrim ?? "")?.[1]),
    );
    expect(topBarLayer).toBeLessThan(TAB_BAR);
  });

  // ADR 0023 point 4: the toaster's layer comes from sonner's own stylesheet, so it is checked there.
  it("keeps the toaster above every z-index token of global.css", () => {
    const sonnerCss = Array.from(document.head.querySelectorAll("style"))
      .map((style) => style.textContent)
      .join("");
    const toaster = Number(
      /\[data-sonner-toaster\]\{[^}]*z-index:\s*(\d+)/.exec(sonnerCss)?.[1],
    );
    expect(toaster).toBeGreaterThanOrEqual(TOASTER_FLOOR);
    const tokens = Array.from(declarations)
      .filter(([name]) => name.startsWith("--z-"))
      .map(([, value]) => Number(value));
    expect(tokens.length).toBeGreaterThan(0);
    for (const layer of tokens) expect(layer).toBeLessThan(toaster);
    // global.css never gives the toaster a z-index of its own.
    expect(stylesheet).not.toMatch(/data-sonner-toaster[^{]*\{[^}]*z-index/);
  });
});
