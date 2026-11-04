import { useMessages } from "../../i18n";
import { LobbyField, fieldProps } from "./LobbyField";
import { localDateText } from "./lobbyTime";

/** Date and the two clock times, in the user's local time. The values are read by name on submit. */
export function LobbyTimeFields({
  id,
  errorId,
  initialDate,
}: {
  id: string;
  errorId?: string;
  /** The date the field starts with; today when absent. */
  initialDate?: Date;
}) {
  const m = useMessages();
  return (
    <>
      <LobbyField id={`${id}-date`} label={m.lobbyDateLabel}>
        <input
          {...fieldProps(`${id}-date`, false, errorId)}
          name="date"
          type="date"
          defaultValue={localDateText(initialDate ?? new Date())}
        />
      </LobbyField>
      <LobbyField id={`${id}-start`} label={m.lobbyStartLabel}>
        <input {...fieldProps(`${id}-start`, false)} name="start" type="time" />
      </LobbyField>
      <LobbyField
        id={`${id}-end`}
        label={m.lobbyEndLabel}
        hint={m.lobbyEndHint}
      >
        <input {...fieldProps(`${id}-end`, true)} name="end" type="time" />
      </LobbyField>
    </>
  );
}
