import type { Game, GameInput } from "../../api";
import { useMessages } from "../../i18n";
import { ErrorAlert } from "../../ui";
import { GameForm } from "./GameForm";
import type { GamesState } from "./useGames";

/** Shows the games as the server orders them. A game being changed shows its form in place of its row. */
export function GameList({
  state,
  editingId,
  busy,
  onRetry,
  onEdit,
  onSave,
  onCancelEdit,
  onRemove,
}: {
  state: GamesState;
  editingId?: string;
  busy: boolean;
  onRetry: () => void;
  onEdit: (gameId: string) => void;
  onSave: (gameId: string, input: GameInput) => Promise<string | undefined>;
  onCancelEdit: () => void;
  onRemove: (game: Game) => void;
}) {
  const m = useMessages();

  if (state.status === "loading") return <p>{m.gameListLoading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={onRetry} />;
  if (state.games.length === 0) return <p>{m.gameListEmpty}</p>;

  return (
    <ul className="row-list" role="list">
      {state.games.map((game) =>
        game.id === editingId ? (
          <li key={game.id} className="list-row list-row--editing">
            <GameForm
              game={game}
              submitLabel={m.gameEditSubmit}
              busy={busy}
              onSubmit={(input) => onSave(game.id, input)}
              onCancel={onCancelEdit}
            />
          </li>
        ) : (
          <li key={game.id} className="list-row">
            <span>{game.name}</span>
            <span className="badge">
              {game.defaultMaxPlayers === null
                ? m.gameUnlimited
                : m.gameMaxPlayers(game.defaultMaxPlayers)}
            </span>
            <button
              type="button"
              className="button button--secondary"
              aria-label={`${m.gameEdit}, ${game.name}`}
              onClick={() => onEdit(game.id)}
            >
              {m.gameEdit}
            </button>
            <button
              type="button"
              className="button button--secondary"
              aria-label={`${m.gameRemove}, ${game.name}`}
              onClick={() => onRemove(game)}
            >
              {m.gameRemove}
            </button>
          </li>
        ),
      )}
    </ul>
  );
}
