import { useId, useRef, useState, type ComponentProps, type Ref } from "react";
import {
  INVALID_CAPACITY,
  INVALID_GAME,
  type ChangeResult,
  type Game,
  type GameInput,
} from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { parseGameInput } from "./gameInput";

type SubmitGame = (input: GameInput) => ChangeResult;

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
  onSubmit: SubmitGame;
  onCancel?: () => void;
}) {
  const id = useId();
  const { errorCode, nameRef, maxRef, submit } = useGameFormSubmit(onSubmit);
  const errorId = `${id}-error`;

  return (
    <form
      className="group-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <GameFormFields
        id={id}
        game={game}
        errorCode={errorCode}
        errorId={errorId}
        nameRef={nameRef}
        maxRef={maxRef}
      />
      {errorCode !== undefined && (
        <GameFormError id={errorId} code={errorCode} />
      )}
      <GameFormActions
        submitLabel={submitLabel}
        busy={busy}
        onCancel={onCancel}
      />
    </form>
  );
}

/** The name and max fields. The form's error describes the field it is about. */
function GameFormFields({
  id,
  game,
  errorCode,
  errorId,
  nameRef,
  maxRef,
}: {
  id: string;
  game?: Game;
  errorCode?: string;
  errorId: string;
  nameRef: Ref<HTMLInputElement>;
  maxRef: Ref<HTMLInputElement>;
}) {
  const m = useMessages();
  const aboutMax = errorCode === INVALID_CAPACITY;
  return (
    <>
      <GameFormField
        id={`${id}-name`}
        ref={nameRef}
        name="name"
        label={m.gameNameLabel}
        hint={m.gameNameHint}
        defaultValue={game?.name}
        errorId={errorCode !== undefined && !aboutMax ? errorId : undefined}
      />
      <GameFormField
        id={`${id}-max`}
        ref={maxRef}
        name="defaultMaxPlayers"
        inputMode="numeric"
        label={m.gameMaxPlayersLabel}
        hint={m.gameMaxPlayersHint}
        defaultValue={game?.defaultMaxPlayers ?? ""}
        errorId={aboutMax ? errorId : undefined}
      />
    </>
  );
}

function GameFormError({ id, code }: { id: string; code: string }) {
  const m = useMessages();
  return (
    <p id={id} role="alert" className="field-error">
      {code === INVALID_GAME ? m.gameNameInvalid : toUserMessage(code)}
    </p>
  );
}

function GameFormActions({
  submitLabel,
  busy,
  onCancel,
}: {
  submitLabel: string;
  busy: boolean;
  onCancel?: () => void;
}) {
  const m = useMessages();
  return (
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
  );
}

/** Checks the input locally, then submits it. The error code it ends with is kept, and focus goes to its field. */
function useGameFormSubmit(onSubmit: SubmitGame) {
  const [errorCode, setErrorCode] = useState<string>();
  const nameRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    const parsed = parseGameInput(
      String(data.get("name")),
      String(data.get("defaultMaxPlayers")),
    );
    const code = parsed.ok ? await onSubmit(parsed.input) : parsed.code;
    setErrorCode(code);
    if (code === undefined) form.reset();
    else if (code === INVALID_CAPACITY) maxRef.current?.focus();
    else nameRef.current?.focus();
  }

  return { errorCode, nameRef, maxRef, submit };
}

/** A labelled text field with its hint. `errorId` is set when the form's error is about this field. */
function GameFormField({
  id,
  label,
  hint,
  errorId,
  ...input
}: ComponentProps<"input"> & {
  id: string;
  label: string;
  hint: string;
  errorId?: string;
}) {
  const hintId = `${id}-hint`;
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        aria-invalid={errorId !== undefined || undefined}
        aria-describedby={errorId ? `${hintId} ${errorId}` : hintId}
        {...input}
      />
      <p id={hintId} className="form-hint">
        {hint}
      </p>
    </>
  );
}
