import { useId, useState } from "react";
import type { ChangeResult, CreateLobbyInput, Game } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { LobbyGameFields } from "./LobbyGameFields";
import { LobbyTimeFields } from "./LobbyTimeFields";
import { fieldOf } from "./lobbyFieldOf";
import { LOBBY_TIME_MISSING } from "./lobbyErrors";
import { useLobbyFormSubmit } from "./useLobbyFormSubmit";

type SubmitLobby = (input: CreateLobbyInput) => ChangeResult;

/** Game, max players, date, start and end. `onSubmit` resolves to the error code of a failed save. */
export function CreateLobbyForm({
  games,
  busy,
  onSubmit,
}: {
  games: Game[];
  busy: boolean;
  onSubmit: SubmitLobby;
}) {
  const m = useMessages();
  const id = useId();
  const [gameValue, setGameValue] = useState("");
  const { errorCode, submit } = useLobbyFormSubmit(
    gameValue,
    setGameValue,
    onSubmit,
  );
  const errorField = errorCode && fieldOf(errorCode, gameValue);
  const errorId = `${id}-error`;
  const errorFor = (name: string) =>
    errorField === name ? errorId : undefined;

  return (
    <form
      className="group-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit(event.currentTarget);
      }}
    >
      <LobbyGameFields
        id={id}
        games={games}
        gameValue={gameValue}
        onGameChange={setGameValue}
        errorFor={errorFor}
      />
      <LobbyTimeFields id={id} errorId={errorFor("date")} />
      {errorCode && <LobbyFormError id={errorId} code={errorCode} />}
      <button type="submit" className="button" disabled={busy}>
        {m.lobbyCreateSubmit}
      </button>
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
