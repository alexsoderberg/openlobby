import { useId, useState } from "react";
import type { CreateLobbyInput, Game } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { LobbyGameFields } from "./LobbyGameFields";
import { LobbyTimeFields } from "./LobbyTimeFields";
import {
  INVALID_CAPACITY,
  INVALID_GAME,
  LOBBY_TIME_MISSING,
  type SaveResult,
} from "./lobbyErrors";
import { OTHER_GAME, parseLobbyInput, type LobbyFields } from "./lobbyInput";

/** The form field that an error code is about. Time errors are all about the date, the first time field. */
function fieldOf(code: string, gameValue: string): string {
  if (code === INVALID_GAME)
    return gameValue === OTHER_GAME ? "customGameName" : "game";
  return code === INVALID_CAPACITY ? "maxPlayers" : "date";
}

function readFields(form: HTMLFormElement): LobbyFields {
  const data = new FormData(form);
  const text = (name: string) => String(data.get(name) ?? "");
  return {
    game: text("game"),
    customGameName: text("customGameName"),
    maxPlayers: text("maxPlayers"),
    date: text("date"),
    start: text("start"),
    end: text("end"),
  };
}

/** Checks the fields locally, then saves. Keeps the error code the attempt ended with and focuses its field. */
function useLobbyFormSubmit(
  gameValue: string,
  onGameChange: (value: string) => void,
  onSubmit: (input: CreateLobbyInput) => SaveResult,
) {
  const [errorCode, setErrorCode] = useState<string>();

  async function submit(form: HTMLFormElement) {
    const parsed = parseLobbyInput(readFields(form), new Date());
    const code = parsed.ok ? await onSubmit(parsed.input) : parsed.code;
    setErrorCode(code);
    if (code === undefined) {
      form.reset();
      onGameChange("");
      return;
    }
    const field = form.elements.namedItem(fieldOf(code, gameValue));
    if (field instanceof HTMLElement) field.focus();
  }

  return { errorCode, submit };
}

/** Game, max players, date, start and end. `onSubmit` resolves to the error code of a failed save. */
export function CreateLobbyForm({
  games,
  busy,
  onSubmit,
}: {
  games: Game[];
  busy: boolean;
  onSubmit: (input: CreateLobbyInput) => SaveResult;
}) {
  const m = useMessages();
  const id = useId();
  const errorId = `${id}-error`;
  const [gameValue, setGameValue] = useState("");
  const { errorCode, submit } = useLobbyFormSubmit(
    gameValue,
    setGameValue,
    onSubmit,
  );
  const errorField =
    errorCode === undefined ? undefined : fieldOf(errorCode, gameValue);

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
        errorField={errorField}
        errorId={errorId}
      />
      <LobbyTimeFields
        id={id}
        errorId={errorField === "date" ? errorId : undefined}
      />
      {errorCode !== undefined && (
        <p id={errorId} role="alert" className="field-error">
          {errorCode === LOBBY_TIME_MISSING
            ? m.lobbyTimeMissing
            : toUserMessage(errorCode)}
        </p>
      )}
      <button type="submit" className="button" disabled={busy}>
        {m.lobbyCreateSubmit}
      </button>
    </form>
  );
}
