import { useEffect, useId, useRef, useState } from "react";
import type { Lobby } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui";
import type { SaveResult } from "./lobbyErrors";

/**
 * A modal dialog, so the page behind is inert and Escape closes it. Keep gets the first focus, so Enter
 * right after opening does not delete the lobby. A failed delete stays in the dialog, where it is read.
 * `onConfirm` resolves to the error code of a failure. After a success the owner leaves the page.
 */
export function DeleteLobbyDialog({
  lobby,
  busy,
  onConfirm,
  onClose,
}: {
  lobby: Lobby;
  busy: boolean;
  onConfirm: () => SaveResult;
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
      <h2 id={headingId}>{m.lobbyDeleteHeading(lobby.gameName)}</h2>
      <p>{m.lobbyDeleteConfirm}</p>
      {errorCode !== undefined && <Alert>{toUserMessage(errorCode)}</Alert>}
      <div className="form-actions">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={async () => setErrorCode(await onConfirm())}
        >
          {m.lobbyDeleteSubmit}
        </button>
        <button
          type="button"
          className="button button--secondary"
          autoFocus
          onClick={() => dialogRef.current?.close()}
        >
          {m.lobbyDeleteKeep}
        </button>
      </div>
    </dialog>
  );
}
