import type { ApiErrorCode } from "../../api";

/** Contract error codes that the game flows branch on. */
export const GAME_NOT_FOUND = "game_not_found";
export const NOT_ALLOWED = "not_allowed";
export const MODE_TAKEN = "mode_taken" satisfies ApiErrorCode;
export const ACTIVITY_TAKEN = "activity_taken" satisfies ApiErrorCode;
export const GAME_ROLE_TAKEN = "game_role_taken" satisfies ApiErrorCode;
