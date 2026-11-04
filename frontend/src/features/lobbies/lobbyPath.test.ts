import { describe, expect, it } from "vitest";
import { lobbyIdsFromPath, lobbyPath } from "./lobbyPath";

describe("lobby paths", () => {
  it("reads back what it builds", () => {
    expect(lobbyIdsFromPath(lobbyPath("g1", "l1"))).toEqual({
      groupId: "g1",
      lobbyId: "l1",
    });
  });

  it.each(["/groups/g1", "/groups/g1/lobbies/", "/groups/g1/lobbies/l1/x"])(
    "ignores %s",
    (pathname) => {
      expect(lobbyIdsFromPath(pathname)).toBeUndefined();
    },
  );
});
