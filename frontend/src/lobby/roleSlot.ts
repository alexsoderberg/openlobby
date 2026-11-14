import type { Lobby } from "../api";

export type RoleSlot = NonNullable<Lobby["roleSlots"]>[number];

/** The one rule for a full role slot: a slot is full when it has as many players as slots. */
export const hasFreeSlot = (slot: RoleSlot) => slot.playerCount < slot.slots;
