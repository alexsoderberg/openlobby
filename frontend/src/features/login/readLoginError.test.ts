import { describe, expect, it } from "vitest";
import { readLoginError, withoutLoginError } from "./readLoginError";

describe("readLoginError", () => {
  it("returns undefined without the parameter", () => {
    expect(readLoginError("")).toBeUndefined();
  });

  it("returns a known code", () => {
    expect(readLoginError("?loginError=login_denied")).toBe("login_denied");
  });

  it("falls back to login_failed for an unknown code", () => {
    expect(readLoginError("?loginError=%3Cscript%3E")).toBe("login_failed");
  });
});

describe("withoutLoginError", () => {
  it("removes only the login result", () => {
    expect(withoutLoginError("?x=1&loginError=login_failed")).toBe("?x=1");
  });

  it("returns an empty string when nothing else is left", () => {
    expect(withoutLoginError("?loginError=login_denied")).toBe("");
  });
});
