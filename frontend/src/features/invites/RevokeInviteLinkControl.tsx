import { useRef, useState } from "react";
import { useMessages } from "../../i18n";
import { Button, Icon } from "../../ui";

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
      <Button
        ref={revokeRef}
        type="button"
        variant="danger"
        aria-label={`${m.inviteLinkRevoke}, ${description}`}
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        <Icon name="revoke" />
        {m.inviteLinkRevoke}
      </Button>
      {confirming && (
        <div className="invite-link__confirm">
          <p>{m.inviteLinkRevokeConfirm}</p>
          <Button
            type="button"
            variant="danger"
            aria-label={`${m.inviteLinkRevokeSubmit}, ${description}`}
            disabled={busy}
            onClick={() => onRevoke(linkId)}
          >
            <Icon name="revoke" />
            {m.inviteLinkRevokeSubmit}
          </Button>
          <Button
            type="button"
            variant="secondary"
            aria-label={`${m.inviteLinkKeep}, ${description}`}
            autoFocus
            onClick={() => {
              setConfirming(false);
              revokeRef.current?.focus();
            }}
          >
            <Icon name="close" />
            {m.inviteLinkKeep}
          </Button>
        </div>
      )}
    </>
  );
}
