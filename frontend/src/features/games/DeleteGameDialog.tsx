import { useEffect, useRef, useState } from "react";
import type { Game } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui";

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
  onConfirm: () => Promise<string | undefined>;
  onClose: () => void;
}) {
  const m = useMessages();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [errorCode, setErrorCode] = useState<string>();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="remove-game-heading"
      onClose={onClose}
    >
      <h2 id="remove-game-heading">{m.gameRemoveHeading(game.name)}</h2>
      <p>{m.gameRemoveConfirm}</p>
      {errorCode !== undefined && <Alert>{toUserMessage(errorCode)}</Alert>}
      <div className="form-actions">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={async () => {
            setErrorCode(await onConfirm());
          }}
        >
          {m.gameRemoveSubmit}
        </button>
        <button
          type="button"
          className="button button--secondary"
          autoFocus
          onClick={() => dialogRef.current?.close()}
        >
          {m.gameRemoveKeep}
        </button>
      </div>
    </dialog>
  );
}
