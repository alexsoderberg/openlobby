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
import {
  parseStructure,
  usesOwnLimit,
  type StructureDraft,
} from "./gameStructure";

export type GameInputResult =
  | { ok: true; input: GameInput }
  | { ok: false; code: string; field?: string; modeKey?: string };

/** The max players field is not shown for a game with modes or game roles: it then keeps `keptMax`, or the sum of its roles applies. */
function parseDefaultMax(
  maxText: string,
  draft: StructureDraft,
  keptMax: GameInput["defaultMaxPlayers"],
) {
  if (!usesOwnLimit(draft)) return keptMax;
  return draft.gameRoles.length > 0 ? null : parseMaxPlayers(maxText);
}

/** `genreText` is the select's value: empty for no genre. `undefined` is a value outside the list. */
const parseGenre = (genreText: string) =>
  genreText === ""
    ? null
    : GENRE_OPTIONS.find((option) => option === genreText);

/** Quick feedback only. The server applies the same rules and is the source of truth. */
export function parseGameInput(
  nameText: string,
  maxText: string,
  genreText: string,
  draft: StructureDraft,
  keptMax: GameInput["defaultMaxPlayers"] = null,
): GameInputResult {
  const name = trimLikeServer(nameText);
  if (
    !isGameNameLength(name) ||
    name.toLowerCase() === RESERVED_GAME_NAME.toLowerCase()
  )
    return { ok: false, code: INVALID_GAME };

  const defaultMaxPlayers = parseDefaultMax(maxText, draft, keptMax);
  if (defaultMaxPlayers === undefined)
    return { ok: false, code: INVALID_CAPACITY };

  const genre = parseGenre(genreText);
  if (genre === undefined) return { ok: false, code: INVALID_GENRE };

  const structure = parseStructure(draft);
  if (!structure.ok) return structure;
  return {
    ok: true,
    input: { name, defaultMaxPlayers, genre, ...structure.value },
  };
}
