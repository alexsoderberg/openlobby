import type { Genre } from "../api";

export type GenreThemeKey = Genre | "neutral";

/** The closed set of 3D motif shapes. The landing hero builds one 3D shape per kind. */
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

/** What a motif is: `count` is the number of repeated parts (1 to 12). The flat SVG shows the same kind and count. */
export type MotifDescriptor = { kind: MotifKind; count: number };

export type GenreTheme = {
  key: GenreThemeKey;
  /** The name of the CSS custom property that holds the accent colour (tokens live in global.css). */
  accentVar: string;
  patternUrl: string;
  iconUrl: string;
  motif: MotifDescriptor;
  motifUrl: string;
};

// Static files under public/: imported art under 4 KB would be inlined into the main chunk (ADR 0016).
const ART_PATH = "/genre-art";

function themeOf(key: GenreThemeKey, motif: MotifDescriptor): GenreTheme {
  return {
    key,
    accentVar: `--color-genre-${key}`,
    patternUrl: `${ART_PATH}/${key}-pattern.svg`,
    iconUrl: `${ART_PATH}/${key}-icon.svg`,
    motif,
    motifUrl: `${ART_PATH}/${key}-motif.svg`,
  };
}

/** A genre without an entry is a compile error. The motif of each genre is defined here and nowhere else. */
export const GENRE_THEMES: Record<GenreThemeKey, GenreTheme> = {
  shooter: themeOf("shooter", { kind: "reticle", count: 3 }),
  moba: themeOf("moba", { kind: "towers", count: 3 }),
  racing: themeOf("racing", { kind: "chevrons", count: 4 }),
  strategy: themeOf("strategy", { kind: "grid", count: 9 }),
  survival: themeOf("survival", { kind: "peaks", count: 3 }),
  party: themeOf("party", { kind: "confetti", count: 8 }),
  rpg: themeOf("rpg", { kind: "frame", count: 2 }),
  sports: themeOf("sports", { kind: "ball", count: 1 }),
  neutral: themeOf("neutral", { kind: "pin", count: 1 }),
};

/** `null` (no genre, a custom "Other" name, a removed game) gives the neutral theme. */
export function themeForGenre(genre: Genre | null): GenreTheme {
  return GENRE_THEMES[genre ?? "neutral"];
}

/** The genres an admin can choose, in theme order. Derived, so it is no second list. */
export const GENRE_OPTIONS = (
  Object.keys(GENRE_THEMES) as GenreThemeKey[]
).filter((key): key is Genre => key !== "neutral");
