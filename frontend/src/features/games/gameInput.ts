import {
  DEFAULT_MAX_PLAYERS_LIMIT,
  DEFAULT_MAX_PLAYERS_MIN,
  GAME_NAME_MAX_LENGTH,
  RESERVED_GAME_NAME,
  type GameInput,
} from "../../api";
import { INVALID_CAPACITY, INVALID_GAME } from "./gameErrors";

/** Trims the characters Go's strings.TrimSpace removes, so the local check agrees with the server. */
const SERVER_TRIM = /^\p{White_Space}+|\p{White_Space}+$/gu;
const WHOLE_NUMBER = /^\d+$/;

export type GameInputResult =
  { ok: true; input: GameInput } | { ok: false; code: string };

/** Quick feedback only. The server applies the same rules and is the source of truth. */
export function parseGameInput(
  nameText: string,
  maxText: string,
): GameInputResult {
  const name = nameText.replace(SERVER_TRIM, "");
  const length = [...name].length;
  if (
    length === 0 ||
    length > GAME_NAME_MAX_LENGTH ||
    name.toLowerCase() === RESERVED_GAME_NAME.toLowerCase()
  )
    return { ok: false, code: INVALID_GAME };

  const max = maxText.replace(SERVER_TRIM, "");
  if (max === "") return { ok: true, input: { name, defaultMaxPlayers: null } };
  const value = Number(max);
  if (
    !WHOLE_NUMBER.test(max) ||
    value < DEFAULT_MAX_PLAYERS_MIN ||
    value > DEFAULT_MAX_PLAYERS_LIMIT
  )
    return { ok: false, code: INVALID_CAPACITY };
  return { ok: true, input: { name, defaultMaxPlayers: value } };
}
