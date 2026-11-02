import { describe, expect, it } from "vitest";
import { routeFor } from "./route";

describe("routeFor", () => {
  it.each([
    ["/", "start"],
    ["/invite/abc123", "invite"],
    ["/invite/", "notFound"],
    ["/invite/a/b", "notFound"],
    ["/groups", "notFound"],
  ])("maps %s to %s", (pathname, route) => {
    expect(routeFor(pathname)).toBe(route);
  });
});
