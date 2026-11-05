import { useEffect, useId, useRef, useState } from "react";
import type { ChangeResult } from "../api";
import { toUserMessage } from "../i18n";
import { Alert } from "./Alert";

/**
 * A modal confirmation, so the page behind is inert and Escape closes it. The browser returns focus to the button
 * that opened it. A refusal stays in the dialog, where it is read. `onConfirm` resolves to the error code of a
 * failure; after a success the owner has already removed the dialog. Keep gets the first focus, so Enter right
 * after opening does not run the action.
 */
export function ConfirmDialog({
  heading,
  body,
  submitLabel,
  keepLabel,
  busy,
  onConfirm,
  onClose,
}: {
  heading: string;
  body: string;
  submitLabel: string;
  keepLabel: string;
  busy: boolean;
  onConfirm: () => ChangeResult;
  onClose: () => void;
}) {
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
      <h2 id={headingId}>{heading}</h2>
      <p>{body}</p>
      {errorCode !== undefined && <Alert>{toUserMessage(errorCode)}</Alert>}
      <div className="form-actions">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={async () => setErrorCode(await onConfirm())}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          className="button button--secondary"
          autoFocus
          onClick={() => dialogRef.current?.close()}
        >
          {keepLabel}
        </button>
      </div>
    </dialog>
  );
}
