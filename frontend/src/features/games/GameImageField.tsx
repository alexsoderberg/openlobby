import { flushSync } from "react-dom";
import { useId, useRef, useState } from "react";
import type { Game, GameImageKind } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Button, ConfirmDialog, GameLogo, Icon } from "../../ui";
import { useGameImage } from "./useGameImage";

/** The browser's file choice offers only the types the server accepts; the server still checks the bytes. */
const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";

/**
 * One image of a saved game: the current image or the monogram, a file choice that saves at once, and a removal
 * after confirmation. The outcome is an inline status, not a toast (ADR 0026, REQ-0022).
 */
export function GameImageField({
  game,
  kind,
  onChanged,
  onUnauthenticated,
}: {
  game: Game;
  kind: GameImageKind;
  onChanged: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const hintId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [confirming, setConfirming] = useState(false);
  const image = useGameImage(game, kind, onChanged, onUnauthenticated);
  const { state } = image;

  async function remove() {
    const code = await image.remove();
    if (code !== undefined) return code;
    // The modal dialog makes the page inert, and its opener is gone: focus goes to the status once it is closed.
    flushSync(() => setConfirming(false));
    statusRef.current?.focus();
    return undefined;
  }

  return (
    <fieldset className="structure" aria-describedby={hintId}>
      <legend>{m.gameImage[kind]}</legend>
      <div className="image-field__row">
        <GameLogo gameId={game.id} name={game.name} version={image.version} />
        <Button
          type="button"
          variant="secondary"
          disabled={image.busy}
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="upload" />
          {m.gameImageChoose}
        </Button>
        {image.version && (
          <Button
            type="button"
            variant="danger"
            disabled={image.busy}
            onClick={() => setConfirming(true)}
          >
            <Icon name="remove" />
            {m.gameImageRemove}
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES}
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          // Cleared, so choosing the same file again uploads it again.
          event.currentTarget.value = "";
          if (file) void image.upload(file);
        }}
      />
      <p id={hintId} className="form-hint">
        {m.gameImageHint}
      </p>
      <p ref={statusRef} tabIndex={-1} role="status" className="status">
        {state.status === "saving" && m.gameImageSaving}
        {state.status === "saved" && m.gameImageSaved}
        {state.status === "removed" && m.gameImageRemoved}
      </p>
      {state.status === "failed" && (
        <p role="alert" className="field-error">
          {toUserMessage(state.code)}
        </p>
      )}
      {confirming && (
        <ConfirmDialog
          heading={m.gameImageRemoveHeading(game.name)}
          body={m.gameImageRemoveConfirm}
          submitLabel={m.gameImageRemoveSubmit}
          submitIcon="remove"
          danger
          keepLabel={m.gameImageRemoveKeep}
          busy={image.busy}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      )}
    </fieldset>
  );
}
