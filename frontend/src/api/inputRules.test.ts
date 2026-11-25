import { describe, expect, it } from "vitest";
import { parseItemId } from "./inputRules";

describe("parseItemId", () => {
  it.each([
    ["1", 1],
    [" 12 ", 12],
    ["2147483647", 2147483647],
  ])("accepts %j as %d", (text, value) => {
    expect(parseItemId(text)).toBe(value);
  });

  it.each(["", "0", "-1", "1.5", "1e3", "0x1F", "2147483648"])(
    "refuses %j",
    (text) => {
      expect(parseItemId(text)).toBeUndefined();
    },
  );
});
