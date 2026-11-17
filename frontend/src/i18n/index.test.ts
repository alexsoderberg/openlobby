import { describe, expect, it } from "vitest";
import { en } from "./messages/en";
import { isLoginErrorCode, toUserMessage } from "./index";

describe("toUserMessage", () => {
  it("returns the text for a known code", () => {
    expect(toUserMessage("group_not_found")).toBe(en.errors.group_not_found);
  });

  it.each(["made_up_code", "constructor", "__proto__", "toString"])(
    "returns the generic text for %s",
    (code) => {
      expect(toUserMessage(code)).toBe(en.genericError);
    },
  );
});

describe("isLoginErrorCode", () => {
  it.each(["login_denied", "login_failed"])("accepts %s", (value) => {
    expect(isLoginErrorCode(value)).toBe(true);
  });

  it.each(["constructor", "__proto__", "login_other", ""])(
    "rejects %s",
    (value) => {
      expect(isLoginErrorCode(value)).toBe(false);
    },
  );
});

describe("lobbyPlayers", () => {
  it.each([
    [1, null, "1 player"],
    [2, null, "2 players"],
    [0, null, "0 players"],
    [1, 5, "1/5 players"],
    [3, 5, "3/5 players"],
  ] as const)("writes %i of max %s as %s", (count, max, text) => {
    expect(en.lobbyPlayers(count, max)).toBe(text);
  });
});
