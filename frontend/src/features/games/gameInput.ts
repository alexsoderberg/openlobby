import {
  INVALID_CAPACITY,
  INVALID_GAME,
  RESERVED_GAME_NAME,
  isGameNameLength,
  parseMaxPlayers,
  trimLikeServer,
  type GameInput,
} from "../../api";

export type GameInputResult =
  { ok: true; input: GameInput } | { ok: false; code: string };

/** Quick feedback only. The server applies the same rules and is the source of truth. */
export function parseGameInput(
  nameText: string,
  maxText: string,
): GameInputResult {
  const name = trimLikeServer(nameText);
  if (
    !isGameNameLength(name) ||
    name.toLowerCase() === RESERVED_GAME_NAME.toLowerCase()
  )
    return { ok: false, code: INVALID_GAME };

  const defaultMaxPlayers = parseMaxPlayers(maxText);
  return defaultMaxPlayers === undefined
    ? { ok: false, code: INVALID_CAPACITY }
    : { ok: true, input: { name, defaultMaxPlayers } };
}
