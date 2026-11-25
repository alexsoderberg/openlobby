import { describe, expect, it } from "vitest";
import { groupColorIndex } from "./groupColor";

describe("groupColorIndex", () => {
  // Pinned: "a" hashes to 0xe40c292c, the published FNV-1a 32-bit vector, so 3826002220 % 6 + 1 = 5.
  it.each([
    ["a", 5],
    ["3f2504e0-4f89-41d3-9a0c-0305e82c3301", 2],
    ["c", 3],
  ])("gives %s the colour %i", (groupId, index) => {
    expect(groupColorIndex(groupId)).toBe(index);
  });

  // Hashing UTF-16 code units instead would give 5.
  it("hashes the UTF-8 bytes of a non-ASCII ID", () => {
    expect(groupColorIndex("gänget")).toBe(4);
  });

  it("always gives 1 to 6", () => {
    const seen = new Set(
      Array.from({ length: 500 }, (_, n) => groupColorIndex(`group-${n}`)),
    );
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
