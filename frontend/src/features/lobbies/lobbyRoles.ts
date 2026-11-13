import type { Game, GameMode, GameRole, Lobby } from "../../api";

/**
 * The game roles of the new lobby: the mode's, or the game's own when the game has no modes. A game with
 * modes and no mode chosen has none.
 */
export function rolesOf(game?: Game, mode?: GameMode): GameRole[] {
  if (mode) return mode.gameRoles;
  return game?.modes?.length ? [] : (game?.gameRoles ?? []);
}

type RoleSlot = NonNullable<Lobby["roleSlots"]>[number];

export const hasFreeSlot = (slot: RoleSlot) => slot.playerCount < slot.slots;

/**
 * ADR 0022 point 7: the first role slot, in lobby order, of a preferred game role with a free slot.
 * None free gives nothing; Flex is never preselected.
 */
export function preselectedSeat(roleSlots: RoleSlot[], gameRoleIds: string[]) {
  return roleSlots.find(
    (slot) => gameRoleIds.includes(slot.gameRoleId) && hasFreeSlot(slot),
  )?.gameRoleId;
}
