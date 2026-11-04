import { INVALID_CAPACITY, INVALID_GAME } from "../../api";
import { OTHER_GAME } from "./lobbyInput";

/** The form field that an error code is about. Time errors are all about the date, the first time field. */
export function fieldOf(code: string, gameValue: string): string {
  if (code === INVALID_GAME)
    return gameValue === OTHER_GAME ? "customGameName" : "game";
  return code === INVALID_CAPACITY ? "maxPlayers" : "date";
}
