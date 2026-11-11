import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  INVALID_GAME,
  useApi,
  type Game,
  type GameMode,
  type LobbyDetail,
} from "../../api";
import { useChangeAction } from "../../hooks";
import { toLobbyMessage, useMessages } from "../../i18n";
import { ConfirmDialog, ErrorAlert } from "../../ui";
import { LOBBY_CHANGED, LOBBY_GAME_SET, NOT_ALLOWED } from "./lobbyErrors";
import { fieldProps, LobbyField } from "./LobbyField";
import { hasEnded } from "./lobbyTime";
import { useGroupGames } from "./useGroupGames";

type Field = "game" | "mode" | "activity";
/** What the last change ended in: `code` is undefined when it was saved. */
type Outcome = { field: Field; code?: string };
type Props = {
  groupId: string;
  lobby: LobbyDetail;
  onChanged: () => void;
  onUnauthenticated: () => void;
};

/** A saved change, or a stale view, loads the lobby again. */
const reloads = (code?: string) =>
  code === undefined || code === LOBBY_CHANGED || code === LOBBY_GAME_SET;
const errorIdOf = (id: string, field: Field, outcome?: Outcome) =>
  outcome?.field === field && outcome.code ? `${id}-${field}-error` : undefined;

/**
 * Lets a player of an open lobby set its game once, and a player of a lobby with a listed game change its
 * game mode and choose or clear the activity of that mode (ADR 0017). A mode change is confirmed first, since
 * it makes every player flex. Nothing is shown, and no game list is loaded, for a viewer who is not a player,
 * a lobby with a custom game name or an ended lobby.
 */
export function LobbySettings(props: Props) {
  const { lobby } = props;
  const customGame = lobby.gameName !== null && !lobby.gameId;
  if (!lobby.joinedByMe || customGame || hasEnded(lobby)) return null;
  return <LoadedSettings {...props} />;
}

/** Keeps the last change here, so the game's result stays when the reload swaps the game control for the modes. */
function LoadedSettings(props: Props) {
  const { lobby } = props;
  const m = useMessages();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const change = useSettingChange(
    root,
    props.onChanged,
    props.onUnauthenticated,
  );
  const { state, reload } = useGroupGames(
    props.groupId,
    props.onUnauthenticated,
  );
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={reload} />;
  const games = state.status === "loaded" ? state.value : [];
  const modes = games.find((game) => game.id === lobby.gameId)?.modes ?? [];
  const gameErrorId = errorIdOf(id, "game", change.outcome);
  return (
    <div ref={root}>
      {lobby.gameName === null
        ? games.length > 0 && (
            <SettingsSection heading={m.lobbyGameSetHeading}>
              <GameForm
                {...props}
                {...change}
                id={`${id}-game`}
                games={games}
                errorId={gameErrorId}
              />
            </SettingsSection>
          )
        : modes.length > 0 && (
            <SettingsSection heading={m.lobbySettingsHeading}>
              <SettingsForm {...props} {...change} modes={modes} />
            </SettingsSection>
          )}
      <Result field="game" outcome={change.outcome} errorId={gameErrorId} />
    </div>
  );
}

function SettingsSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{heading}</h2>
      {children}
    </section>
  );
}

/**
 * One change at a time: runs it, keeps what it ended in, and moves focus to the control it was about (the
 * dialog has left the page by then). A set game takes the game control off the page on the reload, so focus
 * goes to the game's result instead.
 */
function useSettingChange(
  root: RefObject<HTMLElement | null>,
  onChanged: () => void,
  onUnauthenticated: () => void,
) {
  const { busy, run } = useChangeAction(onUnauthenticated);
  const [outcome, setOutcome] = useState<Outcome>();

  useEffect(() => {
    if (!outcome) return;
    const toResult = outcome.field === "game" && reloads(outcome.code);
    root.current
      ?.querySelector<HTMLElement>(
        toResult ? `[data-result="game"]` : `[name="${outcome.field}"]`,
      )
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
    if (reloads(code)) onChanged();
  }
  return { busy, outcome, apply };
}

type Change = ReturnType<typeof useSettingChange>;

/** The group's games for an open lobby. Sent only with the button, since a game once set never changes. */
function GameForm({
  id,
  groupId,
  lobby,
  games,
  errorId,
  busy,
  apply,
}: Props & Change & { id: string; games: Game[]; errorId?: string }) {
  const m = useMessages();
  const api = useApi();
  const [gameId, setGameId] = useState("");
  return (
    <form
      className="group-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void apply("game", () => api.setLobbyGame(groupId, lobby.id, gameId));
      }}
    >
      <LobbyField id={id} label={m.lobbyGameLabel} hint={m.lobbyGameSetHint}>
        <select
          {...fieldProps(id, true, errorId)}
          name="game"
          value={gameId}
          disabled={busy}
          onChange={(event) => setGameId(event.target.value)}
        >
          <option value="" disabled>
            {m.lobbyGameSetChoose}
          </option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </select>
      </LobbyField>
      <div className="form-actions">
        <button
          type="submit"
          className="button"
          disabled={busy || gameId === ""}
        >
          {m.lobbyGameSetSubmit}
        </button>
      </div>
    </form>
  );
}

function SettingsForm({
  groupId,
  lobby,
  modes,
  busy,
  outcome,
  apply,
}: Props & Change & { modes: GameMode[] }) {
  const m = useMessages();
  const api = useApi();
  const id = useId();
  const [pending, setPending] = useState<GameMode>();
  const activities =
    modes.find((mode) => mode.id === lobby.modeId)?.activities ?? [];
  const errorFor = (field: Field) => errorIdOf(id, field, outcome);

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
    <div className="group-form">
      <ModeSelect
        id={`${id}-mode`}
        lobby={lobby}
        modes={modes}
        disabled={busy}
        errorId={errorFor("mode")}
        onChoose={setPending}
      />
      <Result field="mode" outcome={outcome} errorId={errorFor("mode")} />
      {activities.length > 0 && (
        <>
          <ActivitySelect
            id={`${id}-activity`}
            activities={activities}
            value={lobby.activityId ?? ""}
            disabled={busy}
            errorId={errorFor("activity")}
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
            errorId={errorFor("activity")}
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

/**
 * "Saved." or the plain-text refusal of the last change, when it was about this field. Only the game's result
 * takes focus, since its control leaves the page when the lobby loads again.
 */
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
  const focusable =
    field === "game" ? { tabIndex: -1, "data-result": field } : {};
  if (outcome.code === undefined)
    return (
      <p role="status" className="form-hint" {...focusable}>
        {field === "game" ? m.lobbyGameSaved : m.lobbySettingsSaved}
      </p>
    );
  return (
    <p id={errorId} role="alert" className="field-error" {...focusable}>
      {outcome.code === NOT_ALLOWED
        ? m.lobbySettingsNotPlayer
        : outcome.code === INVALID_GAME
          ? m.lobbyGameSetInvalid
          : toLobbyMessage(outcome.code)}
    </p>
  );
}
