import {
  INVALID_CAPACITY,
  INVALID_GAME,
  INVALID_GENRE,
  RESERVED_GAME_NAME,
  isGameNameLength,
  parseMaxPlayers,
  trimLikeServer,
  type GameInput,
} from "../../api";
import { GENRE_OPTIONS } from "../../genres";

export type GameInputResult =
  { ok: true; input: GameInput } | { ok: false; code: string };

/** Quick feedback only. `genreText` is the select's value: empty for no genre. The server applies the same rules and is the source of truth. */
export function parseGameInput(
  nameText: string,
  maxText: string,
  genreText: string,
): GameInputResult {
  const name = trimLikeServer(nameText);
  if (
    !isGameNameLength(name) ||
    name.toLowerCase() === RESERVED_GAME_NAME.toLowerCase()
  )
    return { ok: false, code: INVALID_GAME };

  const defaultMaxPlayers = parseMaxPlayers(maxText);
  if (defaultMaxPlayers === undefined)
    return { ok: false, code: INVALID_CAPACITY };

  const genre =
    genreText === ""
      ? null
      : GENRE_OPTIONS.find((option) => option === genreText);
  return genre === undefined
    ? { ok: false, code: INVALID_GENRE }
    : { ok: true, input: { name, defaultMaxPlayers, genre } };
}
