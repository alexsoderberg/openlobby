import { useId, useState } from "react";
import type { GameRole } from "../../api";
import { useMessages } from "../../i18n";
import { LobbyField, fieldProps } from "./LobbyField";
import { SeatChoice } from "./SeatChoice";
import { SEAT_FIELD, parseSlot, slotInputName } from "./lobbyInput";

/** A game role with 0 slots cannot be the seat, so its choice is cleared and the creator picks again. */
function clearSeat(form: HTMLFormElement | null, gameRoleId: string) {
  const radio = form?.querySelector<HTMLInputElement>(
    `input[name="${SEAT_FIELD}"][value="${gameRoleId}"]`,
  );
  if (radio) radio.checked = false;
}

/**
 * The role slots of the new lobby, prefilled from the mode's or the game's game roles, and the creator's
 * seat. Max players is their sum, so it has no field. A game role with 0 slots is left out of the lobby
 * and cannot be the seat. The owner keys this component by mode, so a new mode replaces what was typed.
 */
export function LobbyRoleFields({
  id,
  roles,
  slotsErrorId,
  seatErrorId,
}: {
  id: string;
  roles: GameRole[];
  slotsErrorId?: string;
  seatErrorId?: string;
}) {
  const m = useMessages();
  const hintId = `${useId()}-hint`;
  const [slots, setSlots] = useState(() =>
    Object.fromEntries(roles.map((role) => [role.id, String(role.slots)])),
  );
  const total = roles.reduce(
    (sum, role) => sum + (parseSlot(slots[role.id]) ?? 0),
    0,
  );
  return (
    <>
      <fieldset
        className="structure"
        aria-describedby={[hintId, slotsErrorId].filter(Boolean).join(" ")}
      >
        <legend>{m.lobbyRolesLegend}</legend>
        <p id={hintId} className="form-hint">
          {m.lobbyRolesHint}
        </p>
        {roles.map((role) => (
          <LobbyField
            key={role.id}
            id={`${id}-slot-${role.id}`}
            label={m.lobbySlotsLabel(role.name)}
          >
            <input
              {...fieldProps(`${id}-slot-${role.id}`, false, slotsErrorId)}
              name={slotInputName(role.id)}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={slots[role.id]}
              onChange={(event) => {
                setSlots({ ...slots, [role.id]: event.target.value });
                if (!parseSlot(event.target.value))
                  clearSeat(event.target.form, role.id);
              }}
            />
          </LobbyField>
        ))}
        <p aria-live="polite">{m.lobbyRolesTotal(total)}</p>
      </fieldset>
      <SeatChoice
        options={roles.map((role) => ({
          value: role.id,
          label: role.name,
          disabled: !parseSlot(slots[role.id]),
        }))}
        hint={m.lobbySeatCreateHint}
        errorId={seatErrorId}
      />
    </>
  );
}
