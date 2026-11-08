import {
  DEFAULT_MAX_PLAYERS_LIMIT,
  DEFAULT_MAX_PLAYERS_MIN,
  GAME_NAME_MAX_LENGTH,
} from "./client";

/** Contract error codes that both the game and the lobby flows branch on. */
export const INVALID_GAME = "invalid_game";
export const INVALID_CAPACITY = "invalid_capacity";
export const INVALID_GENRE = "invalid_genre";

/** What a change resolves to: the error code of a failure, or undefined on success. */
export type ChangeResult = Promise<string | undefined>;

/** Trims the characters Go's strings.TrimSpace removes, so the local checks agree with the server. */
const SERVER_TRIM = /^\p{White_Space}+|\p{White_Space}+$/gu;
const WHOLE_NUMBER = /^\d+$/;

export function trimLikeServer(text: string): string {
  return text.replace(SERVER_TRIM, "");
}

/** A game name is 1 to GAME_NAME_MAX_LENGTH characters. Expects a name that is already trimmed. */
export function isGameNameLength(name: string): boolean {
  const length = [...name].length;
  return length >= 1 && length <= GAME_NAME_MAX_LENGTH;
}

/** A max players text: `null` when empty (unlimited), the number when valid, `undefined` when not valid. */
export function parseMaxPlayers(text: string): number | null | undefined {
  const trimmed = trimLikeServer(text);
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return WHOLE_NUMBER.test(trimmed) &&
    value >= DEFAULT_MAX_PLAYERS_MIN &&
    value <= DEFAULT_MAX_PLAYERS_LIMIT
    ? value
    : undefined;
}
