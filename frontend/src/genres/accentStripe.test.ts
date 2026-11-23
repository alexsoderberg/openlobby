import { describe, expect, it } from "vitest";
import { cssRules } from "../test/cssTokens";

// REQ-0029 item 10, ADR 0028 section 7: the accent stripe went with the week grid in PR3a. No view draws it.
describe("accent stripe", () => {
  it("is drawn by no rule", () => {
    expect(
      cssRules.filter(({ body }) =>
        /border-left(-color)?:[^;]*--genre-accent/.test(body),
      ),
    ).toEqual([]);
  });
});
