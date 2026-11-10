import {
  INVALID_ACTIVITY,
  INVALID_CAPACITY,
  INVALID_GAME,
  INVALID_GAME_ROLE,
  INVALID_MODE,
} from "../../api";
import { LOBBY_SEAT_MISSING } from "./lobbyErrors";
import { OTHER_GAME, SEAT_FIELD } from "./lobbyInput";

/** The form field that an error code is about. Time errors are all about the date, the first time field. */
export function fieldOf(code: string, gameValue: string): string {
  if (code === INVALID_GAME)
    return gameValue === OTHER_GAME ? "customGameName" : "game";
  if (code === INVALID_MODE) return "mode";
  if (code === INVALID_ACTIVITY) return "activity";
  if (code === INVALID_GAME_ROLE || code === LOBBY_SEAT_MISSING)
    return SEAT_FIELD;
  return code === INVALID_CAPACITY ? "maxPlayers" : "date";
}
