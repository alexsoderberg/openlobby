import { describe, expect, it } from "vitest";
import { routeFor } from "./route";

describe("routeFor", () => {
  it.each([
    ["/", { name: "start" }],
    ["/invite/abc123", { name: "invite", token: "abc123" }],
    ["/invite/", { name: "notFound" }],
    ["/invite/a/b", { name: "notFound" }],
    ["/groups", { name: "groups" }],
    ["/profile", { name: "profile" }],
    ["/profile/", { name: "notFound" }],
    ["/groups/g1", { name: "group", groupId: "g1" }],
    ["/games", { name: "games" }],
    ["/groups/g1/lobbies/l1", { name: "lobby", groupId: "g1", lobbyId: "l1" }],
    ["/groups/g1/lobbies/", { name: "notFound" }],
    ["/groups/g1/lobbies/l1/x", { name: "notFound" }],
    ["/games/", { name: "notFound" }],
    ["/groups/", { name: "notFound" }],
    ["/groups/g1/x", { name: "notFound" }],
  ])("maps %s", (pathname, route) => {
    expect(routeFor(pathname)).toEqual(route);
  });
});
