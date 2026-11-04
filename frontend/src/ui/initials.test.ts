import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it.each([
    ["Friday crew", "FC"],
    ["maja lind berg", "ML"],
    ["Solo", "S"],
    ["  spaced   out ", "SO"],
    ["", ""],
  ])("turns %j into %j", (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});
