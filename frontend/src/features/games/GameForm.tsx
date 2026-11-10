import {
  useId,
  useRef,
  useState,
  type ComponentProps,
  type Dispatch,
  type Ref,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  INVALID_CAPACITY,
  INVALID_GAME,
  type ChangeResult,
  type Game,
  type GameInput,
} from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { GameGenreField } from "./GameGenreField";
import { GameStructureFields } from "./GameStructureFields";
import { parseGameInput } from "./gameInput";
import {
  draftFromGame,
  errorSection,
  hidesDefaultMax,
  isStructureSection,
  type ErrorSection,
  type StructureDraft,
} from "./gameStructure";
import { useFocusRequest } from "./useFocusRequest";

type SubmitGame = (input: GameInput) => ChangeResult;

/**
 * Name, default max players, genre, and the game's modes, game roles and activities (the ID is made by the server).
 * The default max players is not shown while the game has modes or game roles. A failure, local or from
 * the server, is shown next to the field or section it is about and focus moves there.
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
  const [draft, setDraft] = useState(() => draftFromGame(game));
  const requestFocus = useFocusRequest(draft);
  const { failure, nameRef, maxRef, genreRef, submit } = useGameFormSubmit(
    id,
    onSubmit,
    draft,
    setDraft,
    game,
  );
  const errorId = `${id}-error`;
  const section = failure?.section;

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
        section={section}
        errorId={errorId}
        hideMax={hidesDefaultMax(draft)}
        nameRef={nameRef}
        maxRef={maxRef}
        genreRef={genreRef}
      />
      <GameStructureFields
        id={id}
        draft={draft}
        setDraft={setDraft}
        requestFocus={requestFocus}
        errorId={errorId}
        errorSection={isStructureSection(section) ? section : undefined}
        errorField={failure?.field}
      />
      {failure && (
        <GameFormError id={errorId} code={failure.code} section={section} />
      )}
      <GameFormActions
        submitLabel={submitLabel}
        busy={busy}
        onCancel={onCancel}
      />
    </form>
  );
}

/** The name, max and genre fields. The form's error describes the field it is about. */
function GameFormFields({
  id,
  game,
  section,
  errorId,
  hideMax,
  nameRef,
  maxRef,
  genreRef,
}: {
  id: string;
  game?: Game;
  section?: ErrorSection;
  errorId: string;
  hideMax: boolean;
  nameRef: Ref<HTMLInputElement>;
  maxRef: Ref<HTMLInputElement>;
  genreRef: Ref<HTMLSelectElement>;
}) {
  const m = useMessages();
  const describing = (about: ErrorSection) =>
    section === about ? errorId : undefined;
  return (
    <>
      <GameFormField
        id={`${id}-name`}
        ref={nameRef}
        name="name"
        label={m.gameNameLabel}
        hint={m.gameNameHint}
        defaultValue={game?.name}
        errorId={describing("name")}
      />
      {!hideMax && (
        <GameFormField
          id={`${id}-max`}
          ref={maxRef}
          name="defaultMaxPlayers"
          inputMode="numeric"
          label={m.gameMaxPlayersLabel}
          hint={m.gameMaxPlayersHint}
          defaultValue={game?.defaultMaxPlayers ?? ""}
          errorId={describing("max")}
        />
      )}
      <GameGenreField
        id={`${id}-genre`}
        ref={genreRef}
        genre={game?.genre ?? null}
        errorId={describing("genre")}
      />
    </>
  );
}

function GameFormError({
  id,
  code,
  section,
}: {
  id: string;
  code: string;
  section?: ErrorSection;
}) {
  const m = useMessages();
  return (
    <p id={id} role="alert" className="field-error">
      {code === INVALID_GAME
        ? m.gameNameInvalid
        : code === INVALID_CAPACITY && isStructureSection(section)
          ? m.gameStructureCapacityInvalid
          : toUserMessage(code)}
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

type FormFailure = { code: string; section: ErrorSection; field?: string };

const formTexts = (form: HTMLFormElement) => {
  const data = new FormData(form);
  // The default max input is not rendered while the game has modes or game roles.
  return [
    String(data.get("name")),
    String(data.get("defaultMaxPlayers") ?? ""),
    String(data.get("genre")),
  ] as const;
};

/** The element an error is about: the exact entry for a local failure, else the first field of its section. */
function focusError(
  form: HTMLFormElement,
  id: string,
  { section, field }: FormFailure,
  refs: {
    name: RefObject<HTMLInputElement | null>;
    max: RefObject<HTMLInputElement | null>;
    genre: RefObject<HTMLSelectElement | null>;
  },
) {
  if (isStructureSection(section))
    (
      (field && document.getElementById(`${id}-${field}`)) ||
      form.querySelector<HTMLElement>(`[data-section="${section}"] input`)
    )?.focus();
  else if (section === "max") refs.max.current?.focus();
  else if (section === "genre") refs.genre.current?.focus();
  else refs.name.current?.focus();
}

/**
 * Checks the input locally, then submits it. The failure it ends with is kept until the next submit, and focus goes
 * to what it is about.
 */
function useGameFormSubmit(
  id: string,
  onSubmit: SubmitGame,
  draft: StructureDraft,
  setDraft: Dispatch<SetStateAction<StructureDraft>>,
  game?: Game,
) {
  const [failure, setFailure] = useState<FormFailure>();
  const nameRef = useRef<HTMLInputElement>(null);
  const maxRef = useRef<HTMLInputElement>(null);
  const genreRef = useRef<HTMLSelectElement>(null);

  async function submit(form: HTMLFormElement) {
    const parsed = parseGameInput(
      ...formTexts(form),
      draft,
      game?.defaultMaxPlayers,
    );
    const code = parsed.ok ? await onSubmit(parsed.input) : parsed.code;
    if (code === undefined) {
      setFailure(undefined);
      form.reset();
      setDraft(draftFromGame(game));
      return;
    }
    const next = {
      code,
      section: errorSection(code, draft),
      field: parsed.ok ? undefined : parsed.field,
    };
    setFailure(next);
    focusError(form, id, next, { name: nameRef, max: maxRef, genre: genreRef });
  }

  return { failure, nameRef, maxRef, genreRef, submit };
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
