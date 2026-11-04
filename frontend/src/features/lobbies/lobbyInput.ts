import {
  INVALID_CAPACITY,
  INVALID_GAME,
  isGameNameLength,
  parseMaxPlayers,
  trimLikeServer,
  type CreateLobbyInput,
} from "../../api";
import { lobbyTimesFrom } from "./lobbyTime";

/** The select value for the free-text choice. A game's value is its ID, which is a uuid and never this. */
export const OTHER_GAME = "other";

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
  const name = trimLikeServer(fields.customGameName);
  return isGameNameLength(name) ? { customGameName: name } : undefined;
}

/** Quick feedback only. The server applies the same rules and is the source of truth. */
export function parseLobbyInput(
  fields: LobbyFields,
  now: Date,
): LobbyInputResult {
  const game = gameOf(fields);
  if (!game) return { ok: false, code: INVALID_GAME };
  const maxPlayers = parseMaxPlayers(fields.maxPlayers);
  if (maxPlayers === undefined) return { ok: false, code: INVALID_CAPACITY };
  const times = lobbyTimesFrom(fields.date, fields.start, fields.end, now);
  if (!times.ok) return times;
  const { startsAt, endsAt } = times;
  return { ok: true, input: { ...game, maxPlayers, startsAt, endsAt } };
}

/** Reads the form's fields by name. */
export function readFields(form: HTMLFormElement): LobbyFields {
  const data = new FormData(form);
  const text = (name: keyof LobbyFields) => String(data.get(name) ?? "");
  return {
    game: text("game"),
    customGameName: text("customGameName"),
    maxPlayers: text("maxPlayers"),
    date: text("date"),
    start: text("start"),
    end: text("end"),
  };
}
