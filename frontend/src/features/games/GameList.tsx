import type { ChangeResult, Game, GameInput } from "../../api";
import { GenreName } from "../../genres";
import { useMessages } from "../../i18n";
import { ErrorAlert, Icon, IconButton } from "../../ui";
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
  onSave: (gameId: string, input: GameInput) => ChangeResult;
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
          <GameEditRow
            key={game.id}
            game={game}
            busy={busy}
            onSave={(input) => onSave(game.id, input)}
            onCancel={onCancelEdit}
          />
        ) : (
          <GameRow
            key={game.id}
            game={game}
            onEdit={() => onEdit(game.id)}
            onRemove={() => onRemove(game)}
          />
        ),
      )}
    </ul>
  );
}

function GameRow({
  game,
  onEdit,
  onRemove,
}: {
  game: Game;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const m = useMessages();
  return (
    <li className="list-row">
      <span>{game.name}</span>
      <GenreName genre={game.genre} />
      <span className="badge">
        {game.modes?.length
          ? m.gameModeCount(game.modes.length)
          : game.defaultMaxPlayers === null
            ? m.gameUnlimited
            : m.gameMaxPlayers(game.defaultMaxPlayers)}
      </span>
      <IconButton
        icon="edit"
        label={m.gameEdit}
        subject={game.name}
        onClick={onEdit}
      />
      <button
        type="button"
        className="button button--danger"
        aria-label={`${m.gameRemove}, ${game.name}`}
        onClick={onRemove}
      >
        <Icon name="remove" />
        {m.gameRemove}
      </button>
    </li>
  );
}

function GameEditRow({
  game,
  busy,
  onSave,
  onCancel,
}: {
  game: Game;
  busy: boolean;
  onSave: (input: GameInput) => ChangeResult;
  onCancel: () => void;
}) {
  const m = useMessages();
  return (
    <li className="list-row list-row--editing">
      <GameForm
        game={game}
        submitLabel={m.gameEditSubmit}
        submitIcon="save"
        busy={busy}
        onSubmit={onSave}
        onCancel={onCancel}
      />
    </li>
  );
}
