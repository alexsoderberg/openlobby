import type { Lobby } from "../api";
import { useMessages } from "../i18n";

/** "Tank 0/1", "Healer 1/2", "Flex 1" (only with flex players). A full role says so. Nothing for a lobby without role slots. */
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
        const text =
          slot.playerCount >= slot.slots
            ? m.lobbyRoleSlotFull
            : m.lobbyRoleSlot;
        return (
          <li key={slot.gameRoleId} className="badge">
            {text(slot.name, slot.playerCount, slot.slots)}
          </li>
        );
      })}
      {!!lobby.flexCount && (
        <li className="badge">{m.lobbyFlex(lobby.flexCount)}</li>
      )}
    </ul>
  );
}
