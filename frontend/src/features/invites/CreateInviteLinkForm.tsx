import { useEffect, useRef, useState } from "react";
import { INVITE_MAX_USES_DEFAULT, INVITE_MAX_USES_LIMIT } from "../../api";
import { useMessages } from "../../i18n";

const USE_COUNT_OPTIONS = Array.from(
  { length: INVITE_MAX_USES_LIMIT },
  (_, index) => index + 1,
);
const HINT_ID = "invite-max-uses-hint";

/** The preselected value is UI state. The chosen value is sent, and the server decides what is valid. */
export function CreateInviteLinkForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (maxUses: number) => void;
}) {
  const m = useMessages();
  const [maxUses, setMaxUses] = useState(INVITE_MAX_USES_DEFAULT);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <form
      className="group-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(maxUses);
      }}
    >
      <label htmlFor="invite-max-uses">{m.inviteMaxUsesLabel}</label>
      <select
        ref={selectRef}
        id="invite-max-uses"
        value={maxUses}
        aria-describedby={HINT_ID}
        onChange={(event) => setMaxUses(Number(event.target.value))}
      >
        {USE_COUNT_OPTIONS.map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </select>
      <p id={HINT_ID} className="form-hint">
        {m.inviteMaxUsesHint}
      </p>
      <button type="submit" className="button" disabled={busy}>
        {m.createInviteLinkSubmit}
      </button>
    </form>
  );
}
