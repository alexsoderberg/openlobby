import type { PickedStart } from "../../calendar";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { ChangeResult, CreateLobbyInput, Game } from "../../api";
import { toLobbyMessage, useMessages } from "../../i18n";
import { Icon } from "../../ui";
import { INVALID_CAPACITY } from "../../api";
import { LobbyGameFields } from "./LobbyGameFields";
import { LobbyModeFields } from "./LobbyModeFields";
import { LobbyTimeFields } from "./LobbyTimeFields";
import { LOBBY_SEAT_MISSING, LOBBY_TIME_MISSING } from "./lobbyErrors";
import { rolesOf } from "./lobbyRoles";
import { useLobbyFormSubmit } from "./useLobbyFormSubmit";

type CreateLobbyFormProps = {
  games: Game[];
  busy: boolean;
  onSubmit: (input: CreateLobbyInput) => ChangeResult;
  initialStart?: PickedStart;
  onCancel: () => void;
};

/** Game, mode, activity, role slots with the seat or max players, date, start and end. `onSubmit` resolves to the error code of a failed save. */
export function CreateLobbyForm(props: CreateLobbyFormProps) {
  const { games, busy, onSubmit, initialStart, onCancel } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const [gameValue, setGameValue] = useState("");
  const [modeValue, setModeValue] = useState("");
  const reset = () => {
    setGameValue("");
    setModeValue("");
  };
  const game = games.find((candidate) => candidate.id === gameValue);
  const mode = game?.modes?.find((candidate) => candidate.id === modeValue);
  const roles = rolesOf(game, mode);
  const form = useLobbyFormSubmit(gameValue, reset, onSubmit);
  // The form opens in a popover, so focus moves in; the first field is the game.
  useEffect(() => {
    formRef.current?.querySelector("select")?.focus({ preventScroll: true });
  }, []);
  const errorId = `${id}-error`;
  const errorFor = (name: string) =>
    form.errorField === name ? errorId : undefined;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void form.submit(event.currentTarget);
  };

  return (
    <form
      ref={formRef}
      className="group-form"
      noValidate
      onSubmit={handleSubmit}
    >
      <LobbyGameFields
        id={id}
        games={games}
        gameValue={gameValue}
        onGameChange={(value) => {
          setGameValue(value);
          setModeValue("");
        }}
        errorFor={errorFor}
      />
      <LobbyModeFields
        id={id}
        game={game}
        mode={mode}
        roles={roles}
        modeValue={modeValue}
        onModeChange={setModeValue}
        errorFor={errorFor}
      />
      <LobbyTimeFields
        id={id}
        errorId={errorFor("date")}
        initialStart={initialStart}
      />
      {form.errorCode && (
        <LobbyFormError
          id={errorId}
          code={form.errorCode}
          hasRoles={roles.length > 0}
          hasMode={mode !== undefined}
        />
      )}
      <LobbyFormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

/** The local codes have their own texts; with game roles, a capacity error is about the slots. */
function LobbyFormError({
  id,
  code,
  hasRoles,
  hasMode,
}: {
  id: string;
  code: string;
  hasRoles: boolean;
  hasMode: boolean;
}) {
  const m = useMessages();
  const text =
    code === LOBBY_TIME_MISSING
      ? m.lobbyTimeMissing
      : code === LOBBY_SEAT_MISSING
        ? m.lobbySeatMissing
        : code === INVALID_CAPACITY && hasRoles
          ? m.lobbySlotsInvalid
          : code === INVALID_CAPACITY && hasMode
            ? m.lobbyModeMaxPlayersInvalid
            : toLobbyMessage(code);
  return (
    <p id={id} role="alert" className="field-error">
      {text}
    </p>
  );
}

function LobbyFormActions({
  busy,
  onCancel,
}: {
  busy: boolean;
  onCancel: () => void;
}) {
  const m = useMessages();
  return (
    <div className="form-actions">
      <button type="submit" className="button" disabled={busy}>
        <Icon name="plus" />
        {m.lobbyCreateSubmit}
      </button>
      <button
        type="button"
        className="button button--secondary"
        onClick={onCancel}
      >
        <Icon name="close" />
        {m.cancel}
      </button>
    </div>
  );
}
