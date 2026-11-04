import { describe, expect, it } from "vitest";
import { parseGameInput } from "./gameInput";

describe("parseGameInput", () => {
  it.each([
    ["Catan", "4", { name: "Catan", defaultMaxPlayers: 4 }],
    ["  Catan  ", "", { name: "Catan", defaultMaxPlayers: null }],
    [
      "x".repeat(50),
      "2147483647",
      { name: "x".repeat(50), defaultMaxPlayers: 2147483647 },
    ],
  ])("accepts %j with max %j", (name, max, input) => {
    expect(parseGameInput(name, max)).toEqual({ ok: true, input });
  });

  it.each([
    ["", "invalid_game"],
    ["   ", "invalid_game"],
    ["x".repeat(51), "invalid_game"],
    ["Other", "invalid_game"],
    ["  oTHER ", "invalid_game"],
  ])("rejects the name %j", (name, code) => {
    expect(parseGameInput(name, "")).toEqual({ ok: false, code });
  });

  it.each(["0", "-3", "2.5", "abc", "2147483648"])(
    "rejects the max %j",
    (max) => {
      expect(parseGameInput("Catan", max)).toEqual({
        ok: false,
        code: "invalid_capacity",
      });
    },
  );
});
