import { describe, expect, it } from "vitest";
import { routeFor } from "./route";

describe("routeFor", () => {
  it.each([
    ["/", { name: "start" }],
    ["/invite/abc123", { name: "invite" }],
    ["/invite/", { name: "notFound" }],
    ["/invite/a/b", { name: "notFound" }],
    ["/groups/g1", { name: "group", groupId: "g1" }],
    ["/groups/", { name: "notFound" }],
    ["/groups/g1/x", { name: "notFound" }],
  ])("maps %s", (pathname, route) => {
    expect(routeFor(pathname)).toEqual(route);
  });
});
