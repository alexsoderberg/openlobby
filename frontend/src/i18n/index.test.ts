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
