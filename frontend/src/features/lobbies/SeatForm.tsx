import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Lobby, Seat } from "../../api";
import { useMessages } from "../../i18n";
import { SeatChoice } from "./SeatChoice";
import { FLEX_SEAT, SEAT_FIELD } from "./lobbyInput";

/**
 * The seat choice of a lobby with game roles, for joining and for changing seat. A game role with no free
 * slot is disabled and says "full"; the player's own game role stays open. `seat` is the current seat:
 * a game role ID, `null` for flex, or undefined for a player who has none yet.
 */
export function SeatForm({
  roleSlots,
  seat,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  roleSlots: NonNullable<Lobby["roleSlots"]>;
  seat?: string | null;
  submitLabel: string;
  busy: boolean;
  /** The text of a refused save, shown next to the choice. */
  error?: string;
  onSubmit: (seat: Seat) => void;
  onCancel: () => void;
}) {
  const m = useMessages();
  const formRef = useRef<HTMLFormElement>(null);
  const [missing, setMissing] = useState(false);
  const errorText = missing ? m.lobbySeatMissing : error;
  const errorId = useId();
  // The form replaces the button that opened it, so focus moves in: to the current seat, else the first choice.
  useEffect(() => {
    const form = formRef.current;
    (
      form?.querySelector<HTMLElement>("input:checked") ??
      form?.querySelector<HTMLElement>("input:not(:disabled)")
    )?.focus();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const choice = String(
      new FormData(event.currentTarget).get(SEAT_FIELD) ?? "",
    );
    setMissing(choice === "");
    if (choice !== "")
      onSubmit(choice === FLEX_SEAT ? { flex: true } : { gameRoleId: choice });
  }

  return (
    <form
      ref={formRef}
      className="group-form seat-form"
      noValidate
      onSubmit={handleSubmit}
    >
      <SeatChoice
        options={roleSlots.map((slot) => {
          const full =
            slot.playerCount >= slot.slots && slot.gameRoleId !== seat;
          return {
            value: slot.gameRoleId,
            label: (full ? m.lobbyRoleSlotFull : m.lobbyRoleSlot)(
              slot.name,
              slot.playerCount,
              slot.slots,
            ),
            disabled: full,
          };
        })}
        defaultValue={seat === null ? FLEX_SEAT : (seat ?? undefined)}
        errorId={errorText ? errorId : undefined}
      />
      {errorText && (
        <p id={errorId} role="alert" className="field-error">
          {errorText}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="button" disabled={busy}>
          {submitLabel}
        </button>
        <button
          type="button"
          className="button button--secondary"
          onClick={onCancel}
        >
          {m.cancel}
        </button>
      </div>
    </form>
  );
}
