import type { Lobby } from "../api";
import { useMessages } from "../i18n";
import { Icon } from "../ui";
import { hasFreeSlot, type RoleSlot } from "./roleSlot";

/** "Tank 1/1". A full slot adds ", full" for screen readers; the look of full is up to the caller. */
export function RoleSlotText({
  slot,
  full,
}: {
  slot: Pick<RoleSlot, "name" | "playerCount" | "slots">;
  full: boolean;
}) {
  const m = useMessages();
  return (
    <>
      {m.lobbyRoleSlot(slot.name, slot.playerCount, slot.slots)}
      {full && (
        <span className="visually-hidden">{m.lobbyRoleSlotFullSuffix}</span>
      )}
    </>
  );
}

/**
 * "Tank 0/1", "Healer 1/2", "Flex 1" (only with flex players). A full role is a filled badge with a check
 * after the count, so full never rests on colour alone. Nothing for a lobby without role slots.
 */
export function RoleSlots({
  lobby,
}: {
  lobby: Pick<Lobby, "roleSlots" | "flexCount">;
}) {
  const m = useMessages();
  const slots = lobby.roleSlots ?? [];
  if (slots.length === 0) return null;
  return (
    <ul className="role-slots" role="list" aria-label={m.lobbyRoleSlotsLabel}>
      {slots.map((slot) => {
        const full = !hasFreeSlot(slot);
        return (
          <li
            key={slot.gameRoleId}
            className={full ? "badge badge--full" : "badge"}
          >
            <RoleSlotText slot={slot} full={full} />
            {full && <Icon name="full" className="role-slot-check" />}
          </li>
        );
      })}
      {!!lobby.flexCount && (
        <li className="badge">{m.lobbyFlex(lobby.flexCount)}</li>
      )}
    </ul>
  );
}
