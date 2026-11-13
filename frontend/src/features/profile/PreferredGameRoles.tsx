import { useEffect, useId, useRef } from "react";
import {
  INVALID_GAME_ROLE,
  type Game,
  type PreferredGameRoleChoices,
} from "../../api";
import { useMessages } from "../../i18n";
import { Alert, ErrorAlert, Icon, Panel } from "../../ui";
import {
  usePreferredGameRoles,
  type SaveOutcome,
} from "./usePreferredGameRoles";

const FIELD = "gameRoleId";

/** The game roles to offer: the game's own, then each mode's with the mode name. The server sends only effective ones. */
function offeredRolesOf(game: Game) {
  return [
    ...(game.gameRoles ?? []).map((role) => ({ role, modeName: null })),
    ...(game.modes ?? []).flatMap((mode) =>
      mode.gameRoles.map((role) => ({ role, modeName: mode.name })),
    ),
  ];
}

/** The You page section where a member picks the game roles they play, one choice for all groups (REQ-0021). */
export function PreferredGameRoles({
  onUnauthenticated,
}: {
  onUnauthenticated: () => void;
}) {
  const m = useMessages().preferredGameRoles;
  const id = useId();
  const headingId = `${id}-heading`;
  const hintId = `${id}-hint`;
  const { choices, reload, ...saving } =
    usePreferredGameRoles(onUnauthenticated);
  return (
    <Panel>
      <h2 id={headingId}>{m.heading}</h2>
      <p id={hintId} className="form-hint">
        {m.hint}
      </p>
      {choices.status === "loading" && <p role="status">{m.loading}</p>}
      {choices.status === "error" && (
        <ErrorAlert code={choices.code} onRetry={reload} />
      )}
      {choices.status === "loaded" &&
        (choices.value.games.length === 0 ? (
          <p>{m.empty}</p>
        ) : (
          <ChoiceForm
            choices={choices.value}
            headingId={headingId}
            hintId={hintId}
            {...saving}
          />
        ))}
    </Panel>
  );
}

/**
 * Uncontrolled check boxes keyed by game role, so a reload after `invalid_game_role` drops only the removed role
 * and keeps the rest of what the member ticked. Focus goes to the status line after a save, and to Save after a
 * failure, once the list has loaded again.
 */
function ChoiceForm({
  choices,
  headingId,
  hintId,
  busy,
  reloading,
  outcome,
  save,
}: {
  choices: PreferredGameRoleChoices;
  headingId: string;
  hintId: string;
  busy: boolean;
  reloading: boolean;
  outcome?: SaveOutcome;
  save: (gameRoleIds: string[]) => void;
}) {
  const m = useMessages().preferredGameRoles;
  const formRef = useRef<HTMLFormElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (outcome && !reloading)
      (outcome.code ? submitRef : statusRef).current?.focus();
  }, [outcome, reloading]);

  return (
    <form
      ref={formRef}
      className="group-form"
      aria-labelledby={headingId}
      aria-describedby={hintId}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        save(form.getAll(FIELD).map(String));
      }}
    >
      {choices.games.map((game) => (
        <fieldset key={game.id} className="structure">
          <legend>{game.name}</legend>
          {offeredRolesOf(game).map(({ role, modeName }) => (
            <label key={role.id} className="choice-option">
              <input
                type="checkbox"
                name={FIELD}
                value={role.id}
                defaultChecked={choices.gameRoleIds.includes(role.id)}
              />
              {modeName ? m.roleWithMode(role.name, modeName) : role.name}
            </label>
          ))}
        </fieldset>
      ))}
      {outcome?.code === INVALID_GAME_ROLE ? (
        <Alert>{m.removedRole}</Alert>
      ) : (
        outcome?.code && (
          <ErrorAlert
            code={outcome.code}
            onRetry={() => formRef.current?.requestSubmit()}
          />
        )
      )}
      <div className="form-actions">
        <button
          ref={submitRef}
          type="submit"
          className="button"
          disabled={busy || reloading}
        >
          <Icon name="save" />
          {m.save}
        </button>
      </div>
      <p ref={statusRef} tabIndex={-1} role="status" className="status">
        {outcome && !outcome.code && m.saved}
      </p>
    </form>
  );
}
