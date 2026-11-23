import type { Genre } from "../api";

// Only the landing hero reads these themes: the app shows no genre look (ADR 0028 section 7). So only the genres of
// the hero's sample cards have a theme, with their art and accent token. The hero is restyled and this file deleted
// in PR5b.

/** The closed set of 3D motif shapes. The landing hero builds one 3D shape per kind (heroScene.ts, PR5b). */
export type MotifKind =
  | "reticle"
  | "towers"
  | "chevrons"
  | "grid"
  | "peaks"
  | "confetti"
  | "frame"
  | "ball"
  | "pin";

/** What a motif is: `count` is the number of repeated parts (1 to 12). */
export type MotifDescriptor = { kind: MotifKind; count: number };

export type GenreTheme = {
  key: Genre;
  /** The name of the CSS custom property that holds the accent colour (tokens live in global.css). */
  accentVar: string;
  patternUrl: string;
  iconUrl: string;
  motif: MotifDescriptor;
};

// Static files under public/: imported art under 4 KB would be inlined into the main chunk (ADR 0016).
const ART_PATH = "/genre-art";

function themeOf(key: Genre, motif: MotifDescriptor): GenreTheme {
  return {
    key,
    accentVar: `--color-genre-${key}`,
    patternUrl: `${ART_PATH}/${key}-pattern.svg`,
    iconUrl: `${ART_PATH}/${key}-icon.svg`,
    motif,
  };
}

const HERO_THEMES: Partial<Record<Genre, GenreTheme>> = {
  shooter: themeOf("shooter", { kind: "reticle", count: 3 }),
  racing: themeOf("racing", { kind: "chevrons", count: 4 }),
  party: themeOf("party", { kind: "confetti", count: 8 }),
};

/** The theme of a hero sample card's genre. Another genre has no art or token, so it fails fast. */
export function themeForGenre(genre: Genre): GenreTheme {
  const theme = HERO_THEMES[genre];
  if (!theme) throw new Error(`No hero theme for the genre ${genre}`);
  return theme;
}
