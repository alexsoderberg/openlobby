import type { Game, GameMode, GameRole } from "../../api";

/**
 * The game roles of the new lobby: the mode's, or the game's own when the game has no modes. A game with
 * modes and no mode chosen has none.
 */
export function rolesOf(game?: Game, mode?: GameMode): GameRole[] {
  if (mode) return mode.gameRoles;
  return game?.modes?.length ? [] : (game?.gameRoles ?? []);
}
