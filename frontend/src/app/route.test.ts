import { describe, expect, it } from "vitest";
import { routeFor } from "./route";

describe("routeFor", () => {
  it.each([
    ["/", { name: "start" }],
    ["/invite/abc123", { name: "invite", token: "abc123" }],
    ["/invite/", { name: "notFound" }],
    ["/invite/a/b", { name: "notFound" }],
    ["/groups/g1", { name: "group", groupId: "g1" }],
    ["/games", { name: "games" }],
    ["/games/", { name: "notFound" }],
    ["/groups/", { name: "notFound" }],
    ["/groups/g1/x", { name: "notFound" }],
  ])("maps %s", (pathname, route) => {
    expect(routeFor(pathname)).toEqual(route);
  });
});
