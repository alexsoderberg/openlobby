import { useEffect, useId, useRef, useState } from "react";
import type { Game } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui";
import type { ChangeResult } from "./gameErrors";

/**
 * A modal dialog, so the page behind is inert and Escape closes it. The browser returns focus to the
 * button that opened it when the dialog closes. A failed removal stays in the dialog, where it is read.
 * `onConfirm` resolves to the error code of a failure. After a success the owner has already removed the dialog.
 */
export function DeleteGameDialog({
  game,
  busy,
  onConfirm,
  onClose,
}: {
  game: Game;
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
      <h2 id={headingId}>{m.gameRemoveHeading(game.name)}</h2>
      <p>{m.gameRemoveConfirm}</p>
      {errorCode !== undefined && <Alert>{toUserMessage(errorCode)}</Alert>}
      <DeleteGameActions
        busy={busy}
        onConfirm={async () => setErrorCode(await onConfirm())}
        onKeep={() => dialogRef.current?.close()}
      />
    </dialog>
  );
}

/** Keep gets the first focus, so Enter right after opening does not remove the game. */
function DeleteGameActions({
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
        {m.gameRemoveSubmit}
      </button>
      <button
        type="button"
        className="button button--secondary"
        autoFocus
        onClick={onKeep}
      >
        {m.gameRemoveKeep}
      </button>
    </div>
  );
}
