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
import {
  Button,
  ConfirmDialog,
  ErrorAlert,
  Icon,
  Select,
  showToast,
} from "../../ui";
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
  /** Takes focus after a set game when no settings are left to show: the page heading, which then names it. */
  headingRef: RefObject<HTMLElement | null>;
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

/** Keeps the last change here, so a game's refusal stays when the reload swaps the game control for the modes. */
function LoadedSettings(props: Props) {
  const { lobby } = props;
  const m = useMessages();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const change = useSettingChange(root, props);
  const { state, reload } = useGroupGames(
    props.groupId,
    props.onUnauthenticated,
  );
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={reload} />;
  const games = state.status === "loaded" ? state.value : [];
  const modes = games.find((game) => game.id === lobby.gameId)?.modes ?? [];
  const gameErrorId = errorIdOf(id, "game", change.outcome);
  const section =
    lobby.gameName === null
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
        );
  // Nothing at all when there is nothing to show, so the page gets no empty side column (REQ-0025).
  if (!section && !gameErrorId) return null;
  return (
    <div ref={root}>
      {section}
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
 * One change at a time: runs it, keeps what it ended in, confirms a saved one with a toast (REQ-0022) and moves
 * focus to the control it was about. The reload takes the game control off the page: a refusal then focuses the
 * game's result, and a set game the first control left in the settings (its mode), or else the page heading.
 */
function useSettingChange(
  root: RefObject<HTMLElement | null>,
  {
    lobby,
    headingRef,
    onChanged,
    onUnauthenticated,
  }: Pick<Props, "lobby" | "headingRef" | "onChanged" | "onUnauthenticated">,
) {
  const m = useMessages();
  const { busy, run } = useChangeAction(onUnauthenticated);
  const [outcome, setOutcome] = useState<Outcome>();

  useEffect(() => {
    if (!outcome) return;
    const toResult =
      outcome.field === "game" &&
      outcome.code !== undefined &&
      reloads(outcome.code);
    root.current
      ?.querySelector<HTMLElement>(
        toResult
          ? `[data-result="game"]`
          : `[role="combobox"][id$="-${outcome.field}"]`,
      )
      ?.focus();
  }, [outcome, root]);

  const gameSet =
    outcome?.field === "game" &&
    outcome.code === undefined &&
    lobby.gameName !== null;
  useEffect(() => {
    if (!gameSet) return;
    (
      root.current?.querySelector<HTMLElement>(`[role="combobox"]`) ??
      headingRef.current
    )?.focus();
  }, [gameSet, root, headingRef]);

  function settle(next: Outcome) {
    setOutcome(next);
    if (next.code === undefined)
      showToast(
        next.field === "game" ? m.lobbyGameSaved : m.lobbySettingsSaved,
      );
  }

  /** Runs a change and loads the lobby again when that is due; resolves to the error code of a refusal. */
  async function send(call: () => Promise<void>) {
    setOutcome(undefined);
    const code = await run(call);
    if (reloads(code)) onChanged();
    return code;
  }

  async function apply(field: Field, call: () => Promise<void>) {
    settle({ field, code: await send(call) });
  }
  return { busy, outcome, settle, send, apply };
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
        <Select
          {...fieldProps(id, true, errorId)}
          value={gameId}
          disabled={busy}
          onValueChange={setGameId}
          placeholder={m.lobbyGameSetChoose}
          options={games.map((game) => ({ value: game.id, label: game.name }))}
        />
      </LobbyField>
      <div className="form-actions">
        <Button type="submit" disabled={busy || gameId === ""}>
          <Icon name="save" />
          {m.lobbyGameSetSubmit}
        </Button>
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
  settle,
  send,
  apply,
}: Props & Change & { modes: GameMode[] }) {
  const m = useMessages();
  const api = useApi();
  const id = useId();
  const [pending, setPending] = useState<GameMode>();
  const activities =
    modes.find((mode) => mode.id === lobby.modeId)?.activities ?? [];
  const errorFor = (field: Field) => errorIdOf(id, field, outcome);
  const refusalText = useRefusalText();

  return (
    <div className="group-form">
      <ModeSelect
        id={`${id}-mode`}
        lobby={lobby}
        modes={modes}
        disabled={busy}
        onChoose={setPending}
      />
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
          submitIcon="edit"
          keepLabel={m.lobbyModeChangeKeep}
          busy={busy}
          // A refusal stays in the dialog; a saved mode is confirmed by a toast, once the dialog has closed.
          onConfirm={() =>
            send(() =>
              api.setLobbyMode(
                groupId,
                lobby.id,
                pending.id,
                lobby.modeId ?? null,
              ),
            )
          }
          toMessage={refusalText}
          onClose={(changed) => {
            setPending(undefined);
            if (changed) settle({ field: "mode" });
            // The dialog was opened from the list's option, which is gone, so focus goes back to the mode control.
            document.getElementById(`${id}-mode`)?.focus();
          }}
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
  onChoose,
}: {
  id: string;
  lobby: LobbyDetail;
  modes: GameMode[];
  disabled: boolean;
  onChoose: (mode: GameMode | undefined) => void;
}) {
  const m = useMessages();
  const known = modes.some((mode) => mode.id === lobby.modeId);
  return (
    <LobbyField id={id} label={m.lobbyModeLabel} hint={m.lobbyModeChangeHint}>
      <Select
        {...fieldProps(id, true)}
        value={lobby.modeId ?? ""}
        disabled={disabled}
        onValueChange={(value) =>
          onChoose(modes.find((mode) => mode.id === value))
        }
        placeholder={m.lobbyModeChoose}
        options={[
          // A mode the admin has removed stays with the lobby under its saved name, but is not offered.
          ...(lobby.modeId && !known
            ? [
                {
                  value: lobby.modeId,
                  label: lobby.modeName ?? m.lobbyModeChoose,
                  disabled: true,
                },
              ]
            : []),
          ...modes.map((mode) => ({ value: mode.id, label: mode.name })),
        ]}
      />
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
      <Select
        {...fieldProps(id, false, errorId)}
        value={value}
        disabled={disabled}
        onValueChange={onChoose}
        options={[
          { value: "", label: m.lobbyActivityNone },
          ...activities.map((activity) => ({
            value: activity.id,
            label: activity.name,
          })),
        ]}
      />
    </LobbyField>
  );
}

/**
 * The plain-text refusal of the last change, when it was about this field. Only the game's refusal takes focus,
 * since its control leaves the page when the lobby loads again.
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
  const refusalText = useRefusalText();
  if (outcome?.field !== field || outcome.code === undefined) return null;
  const focusable =
    field === "game" ? { tabIndex: -1, "data-result": field } : {};
  return (
    <p id={errorId} role="alert" className="field-error" {...focusable}>
      {refusalText(outcome.code)}
    </p>
  );
}

/** The lobby settings' words for a refused change, beside its control or in the mode dialog. */
function useRefusalText() {
  const m = useMessages();
  return (code: string) =>
    code === NOT_ALLOWED
      ? m.lobbySettingsNotPlayer
      : code === INVALID_GAME
        ? m.lobbyGameSetInvalid
        : toLobbyMessage(code);
}
