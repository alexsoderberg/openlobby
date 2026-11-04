import { describe, expect, it } from "vitest";
import { activeNavOf } from "./activeNav";
import type { Route } from "./route";

describe("activeNavOf", () => {
  it.each<[Route, object]>([
    [{ name: "start" }, { section: "home" }],
    [{ name: "groups" }, { section: "groups" }],
    [
      { name: "group", groupId: "g1" },
      { section: "groups", groupId: "g1" },
    ],
    [
      { name: "lobby", groupId: "g1", lobbyId: "l1" },
      { section: "groups", groupId: "g1" },
    ],
    [{ name: "profile" }, { section: "profile" }],
    [{ name: "games" }, { section: "profile" }],
    [{ name: "invite", token: "t" }, {}],
    [{ name: "notFound" }, {}],
  ])("marks the navigation for %j", (route, active) => {
    expect(activeNavOf(route)).toEqual(active);
  });
});
