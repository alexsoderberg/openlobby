import type { Game } from "../../api";
import { useMessages } from "../../i18n";
import { LobbyField, fieldProps } from "./LobbyField";
import { OTHER_GAME } from "./lobbyInput";

type FieldError = (name: string) => string | undefined;

/** The game choice and the free-text name for "Other". */
export function LobbyGameFields({
  id,
  games,
  gameValue,
  onGameChange,
  errorFor,
}: {
  id: string;
  games: Game[];
  gameValue: string;
  onGameChange: (value: string) => void;
  errorFor: FieldError;
}) {
  return (
    <>
      <GameSelect
        id={id}
        games={games}
        value={gameValue}
        onChange={onGameChange}
        errorId={errorFor("game")}
      />
      {gameValue === OTHER_GAME && (
        <CustomGameField id={id} errorId={errorFor("customGameName")} />
      )}
    </>
  );
}

/** The group's games in the server's order (most used first), then "Other". */
function GameSelect({
  id,
  games,
  value,
  onChange,
  errorId,
}: {
  id: string;
  games: Game[];
  value: string;
  onChange: (value: string) => void;
  errorId?: string;
}) {
  const m = useMessages();
  return (
    <LobbyField id={`${id}-game`} label={m.lobbyGameLabel}>
      <select
        {...fieldProps(`${id}-game`, false, errorId)}
        name="game"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{m.lobbyGameChoose}</option>
        {games.map((game) => (
          <option key={game.id} value={game.id}>
            {game.name}
          </option>
        ))}
        <option value={OTHER_GAME}>{m.lobbyGameOther}</option>
      </select>
    </LobbyField>
  );
}

function CustomGameField({ id, errorId }: { id: string; errorId?: string }) {
  const m = useMessages();
  return (
    <LobbyField
      id={`${id}-custom`}
      label={m.lobbyCustomGameLabel}
      hint={m.lobbyCustomGameHint}
    >
      <input
        {...fieldProps(`${id}-custom`, true, errorId)}
        name="customGameName"
        type="text"
        autoComplete="off"
      />
    </LobbyField>
  );
}
