import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publicDir, token } from "../test/cssTokens";
import { themeForGenre } from "./genreThemes";

// Until PR5b: the hero's genres keep a theme whose art and accent token exist; other genres have none.
describe("hero genre themes", () => {
  it.each(["shooter", "racing", "party"] as const)(
    "has art and an accent for %s",
    (genre) => {
      const theme = themeForGenre(genre);
      for (const url of [theme.patternUrl, theme.iconUrl])
        expect(existsSync(join(publicDir, url)), url).toBe(true);
      expect(token(theme.accentVar)).toBeTruthy();
    },
  );

  it("fails fast for a genre without a theme", () => {
    expect(() => themeForGenre("moba")).toThrow();
  });
});
