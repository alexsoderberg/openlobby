import { describe, expect, it } from "vitest";
import { parseGameInput } from "./gameInput";
import type { ModeDraft, StructureDraft } from "./gameStructure";

const none: StructureDraft = { gameRoles: [], modes: [] };
const noEntries = { gameRoles: [], modes: [] };
const mode = (change: Partial<ModeDraft>): ModeDraft => ({
  key: "m1",
  name: "Raid",
  maxPlayers: "8",
  gameRoles: [],
  activities: [],
  ...change,
});

describe("parseGameInput", () => {
  it.each([
    [
      "Catan",
      "4",
      { name: "Catan", defaultMaxPlayers: 4, genre: null, ...noEntries },
    ],
    [
      "  Catan  ",
      "",
      { name: "Catan", defaultMaxPlayers: null, genre: null, ...noEntries },
    ],
    [
      "x".repeat(50),
      "2147483647",
      {
        name: "x".repeat(50),
        defaultMaxPlayers: 2147483647,
        genre: null,
        ...noEntries,
      },
    ],
  ])("accepts %j with max %j", (name, max, input) => {
    expect(parseGameInput(name, max, "", none)).toEqual({ ok: true, input });
  });

  it.each([
    ["", "invalid_game"],
    ["   ", "invalid_game"],
    ["x".repeat(51), "invalid_game"],
    ["Other", "invalid_game"],
    ["  oTHER ", "invalid_game"],
  ])("rejects the name %j", (name, code) => {
    expect(parseGameInput(name, "", "", none)).toEqual({ ok: false, code });
  });

  it.each(["0", "-3", "2.5", "abc", "2147483648"])(
    "rejects the max %j",
    (max) => {
      expect(parseGameInput("Catan", max, "", none)).toEqual({
        ok: false,
        code: "invalid_capacity",
      });
    },
  );

  it("accepts a genre from the list and no genre", () => {
    expect(parseGameInput("Catan", "4", "strategy", none)).toEqual({
      ok: true,
      input: {
        name: "Catan",
        defaultMaxPlayers: 4,
        genre: "strategy",
        ...noEntries,
      },
    });
  });

  it.each(["Shooter", "none", "board"])("rejects the genre %j", (genre) => {
    expect(parseGameInput("Catan", "4", genre, none)).toEqual({
      ok: false,
      code: "invalid_genre",
    });
  });
});

describe("parseGameInput with modes and game roles", () => {
  const parse = (draft: StructureDraft, max = "", kept: number | null = null) =>
    parseGameInput("Catan", max, "", draft, kept);

  it("sends a mode with a max players value and no game roles", () => {
    expect(parse({ gameRoles: [], modes: [mode({})] })).toEqual({
      ok: true,
      input: {
        name: "Catan",
        defaultMaxPlayers: null,
        genre: null,
        gameRoles: undefined,
        modes: [
          {
            id: undefined,
            name: "Raid",
            maxPlayers: 8,
            gameRoles: [],
            activities: [],
          },
        ],
      },
    });
  });

  it("sends a mode with game roles without a max, keeping ids", () => {
    const roles = [{ key: "r1", id: "r1", name: " Tank ", slots: "1" }];
    const result = parse({
      gameRoles: [],
      modes: [mode({ id: "m1", gameRoles: roles, maxPlayers: "8" })],
    });
    expect(result).toMatchObject({
      ok: true,
      input: {
        modes: [
          {
            id: "m1",
            maxPlayers: null,
            gameRoles: [{ id: "r1", name: "Tank", slots: 1 }],
          },
        ],
      },
    });
  });

  it("keeps the stored default max and leaves the game roles out while the game has modes", () => {
    const hidden = [{ key: "r1", id: "r1", name: "Tank", slots: "1" }];
    const result = parse({ gameRoles: hidden, modes: [mode({})] }, "", 6);
    expect(result).toMatchObject({ ok: true, input: { defaultMaxPlayers: 6 } });
    expect(result).toHaveProperty("input.gameRoles", undefined);
  });

  it("sends the game roles and no default max for a game without modes", () => {
    const roles = [{ key: "r1", name: "Tank", slots: "2" }];
    expect(parse({ gameRoles: roles, modes: [] }, "9")).toMatchObject({
      ok: true,
      input: {
        defaultMaxPlayers: null,
        gameRoles: [{ name: "Tank", slots: 2 }],
        modes: [],
      },
    });
  });

  it.each([
    ["a mode name", mode({ name: " " }), "invalid_mode", "m1-name"],
    [
      "a mode without roles and max",
      mode({ maxPlayers: "" }),
      "invalid_capacity",
      "m1-max",
    ],
    [
      "an activity name",
      mode({ activities: [{ key: "a1", name: "x".repeat(51) }] }),
      "invalid_activity",
      "a1-name",
    ],
    [
      "a game role name",
      mode({ gameRoles: [{ key: "r1", name: "", slots: "1" }] }),
      "invalid_game_role",
      "r1-name",
    ],
    [
      "game role slots",
      mode({ gameRoles: [{ key: "r1", name: "Tank", slots: "0" }] }),
      "invalid_capacity",
      "r1-slots",
    ],
  ])("rejects %s and names the field", (_, draftMode, code, field) => {
    expect(parse({ gameRoles: [], modes: [draftMode] })).toEqual({
      ok: false,
      code,
      field,
    });
  });
});
