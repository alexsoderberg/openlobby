import { useEffect, useId, useRef, useState } from "react";
import type { ChangeResult } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui";

/** A modal confirmation. A refusal stays in the dialog, where it is read. Cancel gets the first focus. */
export function MakeGroupAdminDialog({
  memberName,
  busy,
  onConfirm,
  onClose,
}: {
  memberName: string;
  busy: boolean;
  onConfirm: () => ChangeResult;
  onClose: () => void;
}) {
  const m = useMessages();
  const headingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [errorCode, setErrorCode] = useState<string>();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={headingId}
      onClose={onClose}
    >
      <h2 id={headingId}>{m.makeAdminHeading(memberName)}</h2>
      <p>{m.makeAdminConfirm}</p>
      {errorCode !== undefined && <Alert>{toUserMessage(errorCode)}</Alert>}
      <div className="form-actions">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={async () => setErrorCode(await onConfirm())}
        >
          {m.makeAdminSubmit}
        </button>
        <button
          type="button"
          className="button button--secondary"
          autoFocus
          onClick={() => dialogRef.current?.close()}
        >
          {m.makeAdminKeep}
        </button>
      </div>
    </dialog>
  );
}
