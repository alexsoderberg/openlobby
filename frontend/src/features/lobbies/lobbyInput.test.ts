import { describe, expect, it } from "vitest";
import { OTHER_GAME, parseLobbyInput, type LobbyFields } from "./lobbyInput";

const now = new Date(2026, 10, 4, 12, 0);
const valid: LobbyFields = {
  game: "game-1",
  mode: "",
  activity: "",
  slots: [],
  seat: "",
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
    ["an empty name for Other", { game: OTHER_GAME, customGameName: "  " }],
    [
      "a name of 51 characters",
      { game: OTHER_GAME, customGameName: "x".repeat(51) },
    ],
  ])("denies %s with invalid_game", (_, fields) => {
    expect(parse(fields)).toEqual({ ok: false, code: "invalid_game" });
  });

  it("builds an open lobby with neither gameId nor customGameName when no game is chosen", () => {
    const result = parse({ game: "" });
    expect(result.ok).toBe(true);
    expect(result.ok && Object.keys(result.input)).toEqual([
      "maxPlayers",
      "startsAt",
      "endsAt",
    ]);
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

describe("parseLobbyInput with mode and game roles", () => {
  const slots = [
    { gameRoleId: "r1", text: "1" },
    { gameRoleId: "r2", text: " 0 " },
  ];

  it("sends the mode and activity only when chosen", () => {
    expect(parse({ mode: "m1", activity: "a1" })).toMatchObject({
      ok: true,
      input: { modeId: "m1", activityId: "a1" },
    });
    const plain = parse({});
    expect(plain.ok && "modeId" in plain.input).toBe(false);
  });

  it("sends the slots and the seat instead of max players", () => {
    const result = parse({ slots, seat: "r1", maxPlayers: "" });
    expect(result).toMatchObject({
      ok: true,
      input: {
        roleSlots: [
          { gameRoleId: "r1", slots: 1 },
          { gameRoleId: "r2", slots: 0 },
        ],
        gameRoleId: "r1",
      },
    });
    expect(result.ok && "maxPlayers" in result.input).toBe(false);
  });

  it("sends flex as the seat", () => {
    expect(parse({ slots, seat: "flex" })).toMatchObject({
      ok: true,
      input: { flex: true },
    });
  });

  it("denies a missing seat with its own code", () => {
    expect(parse({ slots, seat: "" })).toEqual({
      ok: false,
      code: "lobby_seat_missing",
    });
  });

  it.each(["", "-1", "1.5", "x", "2147483648"])(
    "denies the slot %j with invalid_capacity",
    (text) => {
      expect(
        parse({ slots: [{ gameRoleId: "r1", text }], seat: "r1" }),
      ).toEqual({ ok: false, code: "invalid_capacity" });
    },
  );
});
