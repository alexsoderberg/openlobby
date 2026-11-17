import { useEffect, useRef, useState } from "react";
import { INVITE_MAX_USES_DEFAULT, INVITE_MAX_USES_LIMIT } from "../../api";
import { useMessages } from "../../i18n";
import { Icon, Select } from "../../ui";

const MAX_USES_OPTIONS = Array.from(
  { length: INVITE_MAX_USES_LIMIT },
  (_, index) => ({ value: String(index + 1), label: String(index + 1) }),
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
  const selectRef = useRef<HTMLButtonElement>(null);

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
      <Select
        ref={selectRef}
        id="invite-max-uses"
        value={String(maxUses)}
        aria-describedby={HINT_ID}
        onValueChange={(value) => setMaxUses(Number(value))}
        options={MAX_USES_OPTIONS}
      />
      <p id={HINT_ID} className="form-hint">
        {m.inviteMaxUsesHint}
      </p>
      <button type="submit" className="button" disabled={busy}>
        <Icon name="plus" />
        {m.createInviteLinkSubmit}
      </button>
    </form>
  );
}
