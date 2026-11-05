/** Contract error codes that the lobby flows branch on. */
export const LOBBY_IN_PAST = "lobby_in_past";
export const LOBBY_END_NOT_AFTER_START = "lobby_end_not_after_start";
export const LOBBY_NOT_FOUND = "lobby_not_found";
export const LOBBY_HAS_ENDED = "lobby_has_ended";
export const LOBBY_FULL = "lobby_full";
export const GROUP_NOT_FOUND = "group_not_found";
/** Local only: the date or a clock time is empty or not a real date. The server never sees it. */
export const LOBBY_TIME_MISSING = "lobby_time_missing";
