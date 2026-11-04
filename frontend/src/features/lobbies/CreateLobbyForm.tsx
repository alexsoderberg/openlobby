import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { ChangeResult, CreateLobbyInput, Game } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { LobbyGameFields } from "./LobbyGameFields";
import { LobbyTimeFields } from "./LobbyTimeFields";
import { LOBBY_TIME_MISSING } from "./lobbyErrors";
import { useLobbyFormSubmit } from "./useLobbyFormSubmit";

type CreateLobbyFormProps = {
  games: Game[];
  busy: boolean;
  onSubmit: (input: CreateLobbyInput) => ChangeResult;
  initialDate?: Date;
  onCancel: () => void;
};

/** Game, max players, date, start and end. `onSubmit` resolves to the error code of a failed save. */
export function CreateLobbyForm(props: CreateLobbyFormProps) {
  const { games, busy, onSubmit, initialDate, onCancel } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const id = useId();
  const [gameValue, setGameValue] = useState("");
  const form = useLobbyFormSubmit(gameValue, setGameValue, onSubmit);
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
        onGameChange={setGameValue}
        errorFor={errorFor}
      />
      <LobbyTimeFields
        id={id}
        errorId={errorFor("date")}
        initialDate={initialDate}
      />
      {form.errorCode && <LobbyFormError id={errorId} code={form.errorCode} />}
      <LobbyFormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}

function LobbyFormError({ id, code }: { id: string; code: string }) {
  const m = useMessages();
  return (
    <p id={id} role="alert" className="field-error">
      {code === LOBBY_TIME_MISSING ? m.lobbyTimeMissing : toUserMessage(code)}
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
        {m.lobbyCreateSubmit}
      </button>
      <button
        type="button"
        className="button button--secondary"
        onClick={onCancel}
      >
        {m.cancel}
      </button>
    </div>
  );
}
