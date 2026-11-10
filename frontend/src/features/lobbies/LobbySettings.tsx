import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useApi, type GameMode, type LobbyDetail } from "../../api";
import { useChangeAction } from "../../hooks";
import { toLobbyMessage, useMessages } from "../../i18n";
import { ConfirmDialog, ErrorAlert } from "../../ui";
import { LOBBY_CHANGED, NOT_ALLOWED } from "./lobbyErrors";
import { fieldProps, LobbyField } from "./LobbyField";
import { hasEnded } from "./lobbyTime";
import { useGroupGames } from "./useGroupGames";

type Field = "mode" | "activity";
/** What the last change ended in: `code` is undefined when it was saved. */
type Outcome = { field: Field; code?: string };
type Props = {
  groupId: string;
  lobby: LobbyDetail;
  onChanged: () => void;
  onUnauthenticated: () => void;
};

/**
 * Lets a player of the lobby change its game mode and choose or clear the activity of that mode. A mode
 * change is confirmed first, since it makes every player flex. Nothing is shown, and no game list is loaded,
 * for a viewer who is not a player, a lobby with no game or an ended lobby.
 */
export function LobbySettings(props: Props) {
  const { lobby } = props;
  if (!lobby.joinedByMe || !lobby.gameId || hasEnded(lobby)) return null;
  return <LoadedSettings {...props} gameId={lobby.gameId} />;
}

function LoadedSettings({ gameId, ...props }: Props & { gameId: string }) {
  const m = useMessages();
  const { state, reload } = useGroupGames(
    props.groupId,
    props.onUnauthenticated,
  );
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={reload} />;
  const modes =
    state.status === "loaded"
      ? (state.value.find((game) => game.id === gameId)?.modes ?? [])
      : [];
  if (modes.length === 0) return null;
  return (
    <section aria-labelledby="lobby-settings-heading">
      <h2 id="lobby-settings-heading">{m.lobbySettingsHeading}</h2>
      <SettingsForm {...props} modes={modes} />
    </section>
  );
}

/**
 * One change at a time: runs it, keeps what it ended in, and moves focus to the control it was about (the
 * dialog has left the page by then). A saved change or a stale view loads the lobby again.
 */
function useSettingChange(
  root: RefObject<HTMLElement | null>,
  onChanged: () => void,
  onUnauthenticated: () => void,
) {
  const { busy, run } = useChangeAction(onUnauthenticated);
  const [outcome, setOutcome] = useState<Outcome>();

  useEffect(() => {
    if (outcome)
      root.current
        ?.querySelector<HTMLElement>(`[name="${outcome.field}"]`)
        ?.focus();
  }, [outcome, root]);

  /** `settled` runs before the outcome is shown, so a dialog is gone when focus moves. */
  async function apply(
    field: Field,
    call: () => Promise<void>,
    settled?: () => void,
  ) {
    setOutcome(undefined);
    const code = await run(call);
    settled?.();
    setOutcome({ field, code });
    if (code === undefined || code === LOBBY_CHANGED) onChanged();
  }
  return { busy, outcome, apply };
}

function SettingsForm({
  groupId,
  lobby,
  modes,
  onChanged,
  onUnauthenticated,
}: Props & { modes: GameMode[] }) {
  const m = useMessages();
  const api = useApi();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const { busy, outcome, apply } = useSettingChange(
    root,
    onChanged,
    onUnauthenticated,
  );
  const [pending, setPending] = useState<GameMode>();
  const activities =
    modes.find((mode) => mode.id === lobby.modeId)?.activities ?? [];
  const errorIdOf = (field: Field) =>
    outcome?.field === field && outcome.code
      ? `${id}-${field}-error`
      : undefined;

  async function changeMode(mode: GameMode) {
    await apply(
      "mode",
      () => api.setLobbyMode(groupId, lobby.id, mode.id, lobby.modeId ?? null),
      () => setPending(undefined),
    );
    // A refusal is read beside the control, so the dialog closes and never keeps one.
    return undefined;
  }

  return (
    <div ref={root} className="group-form">
      <ModeSelect
        id={`${id}-mode`}
        lobby={lobby}
        modes={modes}
        disabled={busy}
        errorId={errorIdOf("mode")}
        onChoose={setPending}
      />
      <Result field="mode" outcome={outcome} errorId={errorIdOf("mode")} />
      {activities.length > 0 && (
        <>
          <ActivitySelect
            id={`${id}-activity`}
            activities={activities}
            value={lobby.activityId ?? ""}
            disabled={busy}
            errorId={errorIdOf("activity")}
            onChoose={(activityId) =>
              apply("activity", () =>
                activityId
                  ? api.setLobbyActivity(groupId, lobby.id, activityId)
                  : api.clearLobbyActivity(groupId, lobby.id),
              )
            }
          />
          <Result
            field="activity"
            outcome={outcome}
            errorId={errorIdOf("activity")}
          />
        </>
      )}
      {pending && (
        <ConfirmDialog
          heading={m.lobbyModeChangeHeading(pending.name)}
          body={m.lobbyModeChangeConfirm}
          submitLabel={m.lobbyModeChangeSubmit}
          keepLabel={m.lobbyModeChangeKeep}
          busy={busy}
          onConfirm={() => changeMode(pending)}
          onClose={() => setPending(undefined)}
        />
      )}
    </div>
  );
}

function ModeSelect({
  id,
  lobby,
  modes,
  disabled,
  errorId,
  onChoose,
}: {
  id: string;
  lobby: LobbyDetail;
  modes: GameMode[];
  disabled: boolean;
  errorId?: string;
  onChoose: (mode: GameMode | undefined) => void;
}) {
  const m = useMessages();
  const known = modes.some((mode) => mode.id === lobby.modeId);
  return (
    <LobbyField id={id} label={m.lobbyModeLabel} hint={m.lobbyModeChangeHint}>
      <select
        {...fieldProps(id, true, errorId)}
        name="mode"
        value={lobby.modeId ?? ""}
        disabled={disabled}
        onChange={(event) =>
          onChoose(modes.find((mode) => mode.id === event.target.value))
        }
      >
        {/* A mode the admin has removed stays with the lobby under its saved name, but is not offered. */}
        {!known && (
          <option value={lobby.modeId ?? ""} disabled>
            {lobby.modeName ?? m.lobbyModeChoose}
          </option>
        )}
        {modes.map((mode) => (
          <option key={mode.id} value={mode.id}>
            {mode.name}
          </option>
        ))}
      </select>
    </LobbyField>
  );
}

function ActivitySelect({
  id,
  activities,
  value,
  disabled,
  errorId,
  onChoose,
}: {
  id: string;
  activities: GameMode["activities"];
  value: string;
  disabled: boolean;
  errorId?: string;
  /** The chosen activity ID, or "" for none. */
  onChoose: (activityId: string) => void;
}) {
  const m = useMessages();
  return (
    <LobbyField id={id} label={m.lobbyActivityLabel}>
      <select
        {...fieldProps(id, false, errorId)}
        name="activity"
        value={value}
        disabled={disabled}
        onChange={(event) => onChoose(event.target.value)}
      >
        <option value="">{m.lobbyActivityNone}</option>
        {activities.map((activity) => (
          <option key={activity.id} value={activity.id}>
            {activity.name}
          </option>
        ))}
      </select>
    </LobbyField>
  );
}

/** "Saved." or the plain-text refusal of the last change, when it was about this field. */
function Result({
  field,
  outcome,
  errorId,
}: {
  field: Field;
  outcome?: Outcome;
  errorId?: string;
}) {
  const m = useMessages();
  if (outcome?.field !== field) return null;
  if (outcome.code === undefined)
    return (
      <p role="status" className="form-hint">
        {m.lobbySettingsSaved}
      </p>
    );
  return (
    <p id={errorId} role="alert" className="field-error">
      {outcome.code === NOT_ALLOWED
        ? m.lobbySettingsNotPlayer
        : toLobbyMessage(outcome.code)}
    </p>
  );
}
