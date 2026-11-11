import type { MouseEvent } from "react";
import type { PickedStart } from "../../calendar";
import { useMessages } from "../../i18n";
import { LobbyField, fieldProps } from "./LobbyField";
import { localClockText, localDateText, suggestedEnd } from "./lobbyTime";

/** Opens the picker on a click anywhere in the field, not only on its icon, as phones do (REQ-0003). */
function openPicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker();
  } catch {
    // Fallback: the browser's own behaviour, where the picker icon opens it (REQ-0003). Older browsers lack showPicker.
  }
}

/** Date and the two clock times, in the user's local time. The values are read by name on submit. */
export function LobbyTimeFields({
  id,
  errorId,
  initialStart,
}: {
  id: string;
  errorId?: string;
  /** The date the fields begin with, and the start time and an end two hours later when it has a time; today and empty times when absent. */
  initialStart?: PickedStart;
}) {
  const m = useMessages();
  return (
    <>
      <LobbyField id={`${id}-date`} label={m.lobbyDateLabel}>
        <input
          {...fieldProps(`${id}-date`, false, errorId)}
          name="date"
          type="date"
          onClick={openPicker}
          defaultValue={localDateText(initialStart?.moment ?? new Date())}
        />
      </LobbyField>
      <LobbyField id={`${id}-start`} label={m.lobbyStartLabel}>
        <input
          {...fieldProps(`${id}-start`, false)}
          name="start"
          type="time"
          onClick={openPicker}
          defaultValue={
            initialStart?.timed
              ? localClockText(initialStart.moment)
              : undefined
          }
        />
      </LobbyField>
      <LobbyField
        id={`${id}-end`}
        label={m.lobbyEndLabel}
        hint={m.lobbyEndHint}
      >
        <input
          {...fieldProps(`${id}-end`, true)}
          name="end"
          type="time"
          onClick={openPicker}
          defaultValue={
            initialStart?.timed
              ? localClockText(suggestedEnd(initialStart.moment))
              : undefined
          }
        />
      </LobbyField>
    </>
  );
}
