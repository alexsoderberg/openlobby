/** Contract error codes that the game flows branch on. */
export const INVALID_GAME = "invalid_game";
export const INVALID_CAPACITY = "invalid_capacity";
export const GAME_NOT_FOUND = "game_not_found";
export const NOT_ALLOWED = "not_allowed";

/** What a change resolves to: the error code of a failure, or undefined on success. */
export type ChangeResult = Promise<string | undefined>;
