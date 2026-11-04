import { describe, expect, it } from "vitest";
import { OTHER_GAME, parseLobbyInput, type LobbyFields } from "./lobbyInput";

const now = new Date(2026, 10, 4, 12, 0);
const valid: LobbyFields = {
  game: "game-1",
  customGameName: "",
  maxPlayers: "4",
  date: "2026-11-05",
  start: "18:00",
  end: "20:00",
};
const parse = (overrides: Partial<LobbyFields>) =>
  parseLobbyInput({ ...valid, ...overrides }, now);

describe("parseLobbyInput", () => {
  it("builds a request for a listed game", () => {
    expect(parse({})).toEqual({
      ok: true,
      input: {
        gameId: "game-1",
        maxPlayers: 4,
        startsAt: new Date(2026, 10, 5, 18).toISOString(),
        endsAt: new Date(2026, 10, 5, 20).toISOString(),
      },
    });
  });

  it("sends exactly one of gameId and customGameName, trimmed, and null for no limit", () => {
    const result = parse({
      game: OTHER_GAME,
      customGameName: "  Chess ",
      maxPlayers: " ",
    });
    expect(result).toMatchObject({
      ok: true,
      input: { customGameName: "Chess", maxPlayers: null },
    });
    expect(result.ok && "gameId" in result.input).toBe(false);
  });

  it.each([
    ["no game chosen", { game: "" }],
    ["an empty name for Other", { game: OTHER_GAME, customGameName: "  " }],
    [
      "a name of 51 characters",
      { game: OTHER_GAME, customGameName: "x".repeat(51) },
    ],
  ])("denies %s with invalid_game", (_, fields) => {
    expect(parse(fields)).toEqual({ ok: false, code: "invalid_game" });
  });

  it("allows a name of exactly 50 characters", () => {
    expect(parse({ game: OTHER_GAME, customGameName: "x".repeat(50) }).ok).toBe(
      true,
    );
  });

  it.each(["0", "-1", "2.5", "abc", "2147483648"])(
    "denies max players %s with invalid_capacity",
    (maxPlayers) => {
      expect(parse({ maxPlayers })).toEqual({
        ok: false,
        code: "invalid_capacity",
      });
    },
  );

  it("passes on a time error", () => {
    expect(parse({ end: "18:00" })).toEqual({
      ok: false,
      code: "lobby_end_not_after_start",
    });
  });
});
