import {
  DEFAULT_MAX_PLAYERS_LIMIT,
  DEFAULT_MAX_PLAYERS_MIN,
  GAME_NAME_MAX_LENGTH,
  type CreateLobbyInput,
} from "../../api";
import { INVALID_CAPACITY, INVALID_GAME } from "./lobbyErrors";
import { lobbyTimesFrom } from "./lobbyTime";

/** The select value for the free-text choice. A game's value is its ID, which is a uuid and never this. */
export const OTHER_GAME = "other";

/** Trims the characters Go's strings.TrimSpace removes, so the local check agrees with the server. */
const SERVER_TRIM = /^\p{White_Space}+|\p{White_Space}+$/gu;
const WHOLE_NUMBER = /^\d+$/;

export type LobbyFields = {
  game: string;
  customGameName: string;
  maxPlayers: string;
  date: string;
  start: string;
  end: string;
};

export type LobbyInputResult =
  { ok: true; input: CreateLobbyInput } | { ok: false; code: string };

function gameOf(fields: LobbyFields) {
  if (fields.game === "") return undefined;
  if (fields.game !== OTHER_GAME) return { gameId: fields.game };
  const name = fields.customGameName.replace(SERVER_TRIM, "");
  const length = [...name].length;
  return length >= 1 && length <= GAME_NAME_MAX_LENGTH
    ? { customGameName: name }
    : undefined;
}

/** `null` is unlimited; `undefined` is not a valid number. */
function maxPlayersOf(text: string): number | null | undefined {
  const trimmed = text.replace(SERVER_TRIM, "");
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return WHOLE_NUMBER.test(trimmed) &&
    value >= DEFAULT_MAX_PLAYERS_MIN &&
    value <= DEFAULT_MAX_PLAYERS_LIMIT
    ? value
    : undefined;
}

/** Quick feedback only. The server applies the same rules and is the source of truth. */
export function parseLobbyInput(
  fields: LobbyFields,
  now: Date,
): LobbyInputResult {
  const game = gameOf(fields);
  if (!game) return { ok: false, code: INVALID_GAME };
  const maxPlayers = maxPlayersOf(fields.maxPlayers);
  if (maxPlayers === undefined) return { ok: false, code: INVALID_CAPACITY };
  const times = lobbyTimesFrom(fields.date, fields.start, fields.end, now);
  if (!times.ok) return times;
  const { startsAt, endsAt } = times;
  return { ok: true, input: { ...game, maxPlayers, startsAt, endsAt } };
}
