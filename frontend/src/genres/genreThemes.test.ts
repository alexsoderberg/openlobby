import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../i18n/messages/en";
import { publicDir } from "../test/cssTokens";
import { GENRE_OPTIONS, GENRE_THEMES, themeForGenre } from "./genreThemes";

const contract = readFileSync(
  join(import.meta.dirname, "../../../api/calendar/openapi.yaml"),
  "utf8",
);
const contractGenres = (
  /^ {4}Genre:\s+type: string\s+enum: \[([^\]]*)\]/m.exec(contract)?.[1] ?? ""
).split(/,\s*/);

const themes = Object.values(GENRE_THEMES);
const fileOf = (url: string) => readFileSync(join(publicDir, url), "utf8");

describe("genre themes", () => {
  it("has a theme for every genre and neutral, each under its own key", () => {
    expect(Object.keys(GENRE_THEMES).sort()).toEqual(
      [...contractGenres, "neutral"].sort(),
    );
    for (const [key, theme] of Object.entries(GENRE_THEMES))
      expect(theme.key).toBe(key);
  });

  it("offers exactly the contract genres, without neutral", () => {
    expect([...GENRE_OPTIONS].sort()).toEqual([...contractGenres].sort());
    expect(GENRE_OPTIONS).not.toContain("neutral");
  });

  it("gives null the neutral theme and a genre its own", () => {
    expect(themeForGenre(null)).toBe(GENRE_THEMES.neutral);
    expect(themeForGenre("racing")).toBe(GENRE_THEMES.racing);
  });

  it("gives every theme a distinct accent, icon and motif", () => {
    for (const pick of [
      (theme: (typeof themes)[number]) => theme.accentVar,
      (theme: (typeof themes)[number]) => fileOf(theme.iconUrl),
      (theme: (typeof themes)[number]) => theme.motif.kind,
    ])
      expect(new Set(themes.map(pick)).size).toBe(themes.length);
  });

  it("keeps the flat motif in step with its descriptor: one part per count", () => {
    for (const theme of themes) {
      const parts = fileOf(theme.motifUrl).match(/data-part=/g) ?? [];
      expect(parts.length, theme.key).toBe(theme.motif.count);
    }
  });

  it("points every url at a static file under public/", () => {
    for (const theme of themes)
      for (const url of [theme.patternUrl, theme.iconUrl, theme.motifUrl])
        expect(existsSync(join(publicDir, url)), url).toBe(true);
  });

  it("has a label for every genre and for no genre", () => {
    expect(Object.keys(en.genre).sort()).toEqual(
      [...contractGenres, "none"].sort(),
    );
  });
});
