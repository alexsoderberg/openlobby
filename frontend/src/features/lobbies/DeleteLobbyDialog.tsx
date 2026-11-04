import { useEffect, useId, useRef, useState } from "react";
import type { ChangeResult } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui";

/**
 * A modal dialog, so the page behind is inert and Escape closes it. A failed delete stays in the dialog,
 * where it is read. `onConfirm` resolves to the error code of a failure. After a success the owner leaves the page.
 */
export function DeleteLobbyDialog({
  gameName,
  busy,
  onConfirm,
  onClose,
}: {
  gameName: string;
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
      <h2 id={headingId}>{m.lobbyDeleteHeading(gameName)}</h2>
      <p>{m.lobbyDeleteConfirm}</p>
      {errorCode !== undefined && <Alert>{toUserMessage(errorCode)}</Alert>}
      <DeleteLobbyActions
        busy={busy}
        onConfirm={async () => setErrorCode(await onConfirm())}
        onKeep={() => dialogRef.current?.close()}
      />
    </dialog>
  );
}

/** Keep gets the first focus, so Enter right after opening does not delete the lobby. */
function DeleteLobbyActions({
  busy,
  onConfirm,
  onKeep,
}: {
  busy: boolean;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  const m = useMessages();
  return (
    <div className="form-actions">
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={onConfirm}
      >
        {m.lobbyDeleteSubmit}
      </button>
      <button
        type="button"
        className="button button--secondary"
        autoFocus
        onClick={onKeep}
      >
        {m.lobbyDeleteKeep}
      </button>
    </div>
  );
}
