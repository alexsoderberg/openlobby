import type { ChangeResult, Game, GameInput } from "../../api";
import { GenreName } from "../../genres";
import { useMessages } from "../../i18n";
import { Button, ErrorAlert, GameLogo, Icon, IconButton } from "../../ui";
import { GameForm } from "./GameForm";
import { GameImageField } from "./GameImageField";
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
  onImageChanged,
  onUnauthenticated,
}: {
  state: GamesState;
  editingId?: string;
  busy: boolean;
  onRetry: () => void;
  onEdit: (gameId: string) => void;
  onSave: (gameId: string, input: GameInput) => ChangeResult;
  onCancelEdit: () => void;
  onRemove: (game: Game) => void;
  onImageChanged: () => void;
  onUnauthenticated: () => void;
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
            onImageChanged={onImageChanged}
            onUnauthenticated={onUnauthenticated}
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
    <li className="list-row game-row">
      <GameLogo gameId={game.id} name={game.name} version={game.logoVersion} />
      <span className="game-row__text">
        <span className="game-row__name">{game.name}</span>
        <span className="game-row__facts">
          <GenreName genre={game.genre} />
          <span>
            {game.modes?.length
              ? m.gameModeCount(game.modes.length)
              : game.defaultMaxPlayers === null
                ? m.gameUnlimited
                : m.gameMaxPlayers(game.defaultMaxPlayers)}
          </span>
        </span>
      </span>
      <IconButton
        icon="edit"
        label={m.gameEdit}
        subject={game.name}
        onClick={onEdit}
      />
      <Button
        variant="danger"
        type="button"
        aria-label={`${m.gameRemove}, ${game.name}`}
        onClick={onRemove}
      >
        <Icon name="remove" />
        {m.gameRemove}
      </Button>
    </li>
  );
}

function GameEditRow({
  game,
  busy,
  onSave,
  onCancel,
  onImageChanged,
  onUnauthenticated,
}: {
  game: Game;
  busy: boolean;
  onSave: (input: GameInput) => ChangeResult;
  onCancel: () => void;
  onImageChanged: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  return (
    <li className="list-row list-row--editing game-row">
      <GameForm
        game={game}
        submitLabel={m.gameEditSubmit}
        submitIcon="save"
        busy={busy}
        onSubmit={onSave}
        onCancel={onCancel}
        imageFields={
          <>
            <GameImageField
              game={game}
              kind="logo"
              onChanged={onImageChanged}
              onUnauthenticated={onUnauthenticated}
            />
            <GameImageField
              game={game}
              kind="cover"
              onChanged={onImageChanged}
              onUnauthenticated={onUnauthenticated}
            />
          </>
        }
      />
    </li>
  );
}
