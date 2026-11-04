import { useId, useState, type FormEvent } from "react";
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
};

/** Game, max players, date, start and end. `onSubmit` resolves to the error code of a failed save. */
export function CreateLobbyForm(props: CreateLobbyFormProps) {
  const { games, busy, onSubmit } = props;
  const id = useId();
  const [gameValue, setGameValue] = useState("");
  const form = useLobbyFormSubmit(gameValue, setGameValue, onSubmit);
  const errorId = `${id}-error`;
  const errorFor = (name: string) =>
    form.errorField === name ? errorId : undefined;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void form.submit(event.currentTarget);
  };

  return (
    <form className="group-form" noValidate onSubmit={handleSubmit}>
      <LobbyGameFields
        id={id}
        games={games}
        gameValue={gameValue}
        onGameChange={setGameValue}
        errorFor={errorFor}
      />
      <LobbyTimeFields id={id} errorId={errorFor("date")} />
      {form.errorCode && <LobbyFormError id={errorId} code={form.errorCode} />}
      <LobbySubmitButton busy={busy} />
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

function LobbySubmitButton({ busy }: { busy: boolean }) {
  const m = useMessages();
  return (
    <button type="submit" className="button" disabled={busy}>
      {m.lobbyCreateSubmit}
    </button>
  );
}
