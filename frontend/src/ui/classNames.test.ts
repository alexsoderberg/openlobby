import { expect, it } from "vitest";
import { classNames } from "./classNames";

it("joins the class lists that are set", () => {
  expect(classNames("a b", undefined, "", "c")).toBe("a b c");
});
