import { describe, expect, it } from "vitest";
import { declarations, stylesheet } from "../test/cssTokens";

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
});
