import type { Genre } from "../api";

// A Record, so a genre added to the contract and missing here is a compile error.
const GENRES: Record<Genre, true> = {
  shooter: true,
  moba: true,
  racing: true,
  strategy: true,
  survival: true,
  party: true,
  rpg: true,
  sports: true,
};

/** The genres an admin can choose in the game form, in this order (ADR 0016). */
export const GENRE_OPTIONS = Object.keys(GENRES) as Genre[];
