import { useMessages } from "../../i18n";
import { LobbyField, fieldProps } from "./LobbyField";
import { localDateText } from "./lobbyTime";

/** Date and the two clock times, in the user's local time. The values are read by name on submit. */
export function LobbyTimeFields({
  id,
  errorId,
}: {
  id: string;
  errorId?: string;
}) {
  const m = useMessages();
  return (
    <>
      <LobbyField id={`${id}-date`} label={m.lobbyDateLabel}>
        <input
          {...fieldProps(`${id}-date`, false, errorId)}
          name="date"
          type="date"
          defaultValue={localDateText(new Date())}
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
