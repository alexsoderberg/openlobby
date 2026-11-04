import { useId, useRef, useState } from "react";
import type { Game, GameInput } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { INVALID_CAPACITY } from "./gameErrors";
import { parseGameInput } from "./gameInput";

/**
 * Name and default max players, nothing else (the ID is made by the server). A failure, local or from
 * the server, is shown next to the field it is about and focus moves to that field.
 * `onSubmit` resolves to the error code of a failed save.
 */
export function GameForm({
  game,
  submitLabel,
  busy,
  onSubmit,
  onCancel,
}: {
  game?: Game;
  submitLabel: string;
  busy: boolean;
  onSubmit: (input: GameInput) => Promise<string | undefined>;
  onCancel?: () => void;
}) {
  const m = useMessages();
  const id = useId();
  const [errorCode, setErrorCode] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);
  const errorId = `${id}-error`;
  const aboutMax = errorCode === INVALID_CAPACITY;

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const parsed = parseGameInput(
      String(data.get("name")),
      String(data.get("defaultMaxPlayers")),
    );
    const code = parsed.ok ? await onSubmit(parsed.input) : parsed.code;
    setErrorCode(code);
    if (code === undefined) formRef.current?.reset();
    else (code === INVALID_CAPACITY ? maxRef : nameRef).current?.focus();
  }

  return (
    <form
      ref={formRef}
      className="group-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <label htmlFor={`${id}-name`}>{m.gameNameLabel}</label>
      <input
        id={`${id}-name`}
        ref={nameRef}
        name="name"
        type="text"
        autoComplete="off"
        defaultValue={game?.name}
        aria-invalid={(errorCode !== undefined && !aboutMax) || undefined}
        aria-describedby={
          errorCode !== undefined && !aboutMax
            ? `${id}-name-hint ${errorId}`
            : `${id}-name-hint`
        }
      />
      <p id={`${id}-name-hint`} className="form-hint">
        {m.gameNameHint}
      </p>
      <label htmlFor={`${id}-max`}>{m.gameMaxPlayersLabel}</label>
      <input
        id={`${id}-max`}
        ref={maxRef}
        name="defaultMaxPlayers"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        defaultValue={game?.defaultMaxPlayers ?? ""}
        aria-invalid={aboutMax || undefined}
        aria-describedby={
          aboutMax ? `${id}-max-hint ${errorId}` : `${id}-max-hint`
        }
      />
      <p id={`${id}-max-hint`} className="form-hint">
        {m.gameMaxPlayersHint}
      </p>
      {errorCode !== undefined && (
        <p id={errorId} role="alert" className="field-error">
          {toUserMessage(errorCode)}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="button" disabled={busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
          >
            {m.gameEditCancel}
          </button>
        )}
      </div>
    </form>
  );
}
