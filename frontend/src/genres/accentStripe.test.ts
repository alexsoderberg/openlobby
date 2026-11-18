import { describe, expect, it } from "vitest";
import { cssRules } from "../test/cssTokens";

// REQ-0028 item 2, ADR 0016 Amendment 2026-11-18: the 3 px accent stripe is drawn on week grid blocks only,
// and only when the game has a genre. Lobby rows, the lobby page header, the Group card lobby line, Next up
// and the This week day list have none.
describe("accent stripe", () => {
  it("is drawn by one rule, on week grid blocks of a game with a genre", () => {
    const stripes = cssRules.filter(({ body }) =>
      /border-left(-color)?:[^;]*--genre-accent/.test(body),
    );
    expect(stripes.map(({ selector }) => selector)).toEqual([
      '.time-block:not([data-genre="neutral"]) > .time-block__body',
    ]);
  });

  it("is not drawn on the other lobby views", () => {
    for (const host of [
      ".lobby-row",
      ".group-card__lobby",
      ".lobby-head",
      ".next-up",
    ])
      for (const { body } of cssRules.filter(
        ({ selector }) => selector === host,
      ))
        expect(body).not.toMatch(/border-left/);
  });
});
