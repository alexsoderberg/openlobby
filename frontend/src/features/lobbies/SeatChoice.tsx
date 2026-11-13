import { useId } from "react";
import { useMessages } from "../../i18n";
import { FLEX_SEAT, SEAT_FIELD } from "./lobbyInput";

type SeatOption = { value: string; label: string; disabled?: boolean };

/**
 * A game role or flex, as radio buttons named "seat". A game role that cannot be chosen is disabled and
 * its label says why, so the reason is never only a color. The caller reads the choice from the form.
 */
export function SeatChoice({
  options,
  defaultValue,
  hint,
  errorId,
}: {
  options: SeatOption[];
  defaultValue?: string;
  hint?: string;
  errorId?: string;
}) {
  const m = useMessages();
  const hintId = `${useId()}-hint`;
  const describedBy = [hint && hintId, errorId].filter(Boolean).join(" ");
  const all = [...options, { value: FLEX_SEAT, label: m.lobbySeatFlex }];
  return (
    <fieldset className="structure" aria-describedby={describedBy || undefined}>
      <legend>{m.lobbySeatLegend}</legend>
      {hint && (
        <p id={hintId} className="form-hint">
          {hint}
        </p>
      )}
      {all.map(({ value, label, disabled }) => (
        <label key={value} className="choice-option">
          <input
            type="radio"
            name={SEAT_FIELD}
            value={value}
            defaultChecked={value === defaultValue}
            disabled={disabled}
            aria-invalid={errorId !== undefined || undefined}
            aria-describedby={errorId}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
