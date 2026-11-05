import { useEffect, useId, useRef, useState } from "react";
import type { ChangeResult } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui";

/**
 * A modal dialog, so the page behind is inert and Escape closes it. A refusal stays in the dialog, where it is read.
 * Staying gets the first focus, so Enter right after opening does not leave the group.
 */
export function LeaveGroupDialog({
  groupName,
  busy,
  onConfirm,
  onClose,
}: {
  groupName: string;
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
      <h2 id={headingId}>{m.groupLeaveHeading(groupName)}</h2>
      <p>{m.groupLeaveConfirm}</p>
      {errorCode !== undefined && <Alert>{toUserMessage(errorCode)}</Alert>}
      <div className="form-actions">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={async () => setErrorCode(await onConfirm())}
        >
          {m.groupLeaveSubmit}
        </button>
        <button
          type="button"
          className="button button--secondary"
          autoFocus
          onClick={() => dialogRef.current?.close()}
        >
          {m.groupLeaveKeep}
        </button>
      </div>
    </dialog>
  );
}
