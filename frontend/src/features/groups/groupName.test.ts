import { describe, expect, it } from "vitest";
import { isValidGroupName } from "./groupName";

describe("isValidGroupName", () => {
  it.each([
    ["a", true],
    ["Friday crew", true],
    ["x".repeat(50), true],
    ["🎲".repeat(50), true],
    ["  Friday crew  ", true],
    ["", false],
    ["   ", false],
    ["x".repeat(51), false],
    ["  " + "x".repeat(50) + "  ", true],
    ["🎲".repeat(51), false],
    ["\u0085", false],
    ["﻿", true],
  ])("%j is valid: %s", (name, valid) => {
    expect(isValidGroupName(name)).toBe(valid);
  });
});
