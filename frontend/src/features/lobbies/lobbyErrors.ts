/** Contract error codes that the lobby flows branch on. */
export const INVALID_GAME = "invalid_game";
export const INVALID_CAPACITY = "invalid_capacity";
export const LOBBY_IN_PAST = "lobby_in_past";
export const LOBBY_END_NOT_AFTER_START = "lobby_end_not_after_start";
export const LOBBY_NOT_FOUND = "lobby_not_found";
export const GROUP_NOT_FOUND = "group_not_found";
/** Local only: the date or a clock time is empty or not a real date. The server never sees it. */
export const LOBBY_TIME_MISSING = "lobby_time_missing";

/** What a change resolves to: the error code of a failure, or undefined on success. */
export type SaveResult = Promise<string | undefined>;
