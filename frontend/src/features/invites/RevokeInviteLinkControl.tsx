import { useRef, useState } from "react";
import { useMessages } from "../../i18n";

/**
 * Revoking asks first. Keeping the link returns focus to the revoke button, so keyboard users stay
 * where they were. `description` names the link in every button, so the buttons of two links differ.
 */
export function RevokeInviteLinkControl({
  linkId,
  description,
  busy,
  onRevoke,
}: {
  linkId: string;
  description: string;
  busy: boolean;
  onRevoke: (linkId: string) => void;
}) {
  const m = useMessages();
  const [confirming, setConfirming] = useState(false);
  const revokeRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={revokeRef}
        type="button"
        className="button button--secondary"
        aria-label={`${m.inviteLinkRevoke}, ${description}`}
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        {m.inviteLinkRevoke}
      </button>
      {confirming && (
        <div className="invite-link__confirm">
          <p>{m.inviteLinkRevokeConfirm}</p>
          <button
            type="button"
            className="button"
            aria-label={`${m.inviteLinkRevokeSubmit}, ${description}`}
            disabled={busy}
            onClick={() => onRevoke(linkId)}
          >
            {m.inviteLinkRevokeSubmit}
          </button>
          <button
            type="button"
            className="button button--secondary"
            aria-label={`${m.inviteLinkKeep}, ${description}`}
            autoFocus
            onClick={() => {
              setConfirming(false);
              revokeRef.current?.focus();
            }}
          >
            {m.inviteLinkKeep}
          </button>
        </div>
      )}
    </>
  );
}
