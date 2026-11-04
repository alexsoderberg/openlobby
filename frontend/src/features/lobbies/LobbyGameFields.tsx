import type { Game } from "../../api";
import { useMessages } from "../../i18n";
import { LobbyField, fieldProps } from "./LobbyField";
import { OTHER_GAME } from "./lobbyInput";

/** The game choice (most used first, "Other" last), the free-text name for "Other", and max players. */
export function LobbyGameFields({
  id,
  games,
  gameValue,
  onGameChange,
  errorField,
  errorId,
}: {
  id: string;
  games: Game[];
  gameValue: string;
  onGameChange: (value: string) => void;
  errorField?: string;
  errorId: string;
}) {
  const m = useMessages();
  const errorFor = (name: string) =>
    errorField === name ? errorId : undefined;
  // A game's default is only a suggestion. The key makes it replace what was typed when the game changes.
  const suggestedMax = games.find(
    (game) => game.id === gameValue,
  )?.defaultMaxPlayers;

  return (
    <>
      <LobbyField id={`${id}-game`} label={m.lobbyGameLabel}>
        <select
          {...fieldProps(`${id}-game`, false, errorFor("game"))}
          name="game"
          value={gameValue}
          onChange={(event) => onGameChange(event.target.value)}
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
      {gameValue === OTHER_GAME && (
        <LobbyField
          id={`${id}-custom`}
          label={m.lobbyCustomGameLabel}
          hint={m.lobbyCustomGameHint}
        >
          <input
            {...fieldProps(`${id}-custom`, true, errorFor("customGameName"))}
            name="customGameName"
            type="text"
            autoComplete="off"
          />
        </LobbyField>
      )}
      <LobbyField
        id={`${id}-max`}
        label={m.lobbyMaxPlayersLabel}
        hint={m.lobbyMaxPlayersHint}
      >
        <input
          key={gameValue}
          {...fieldProps(`${id}-max`, true, errorFor("maxPlayers"))}
          name="maxPlayers"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={suggestedMax ?? ""}
        />
      </LobbyField>
    </>
  );
}
