package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// shortcut: every lobby count is 0 until REQ-0003 creates the lobbies table. Then this query counts the lobbies of
// groupID per game_id (ADR 0010, amendment review 3) and the application orders by that count. groupID is unused until then.
// The order is the system admin's list order (ADR 0010); the group order is decided in application.
const listGamesSQL = `SELECT id, name, default_max_players FROM games ORDER BY lower(name), id`

const insertGameSQL = `INSERT INTO games (name, default_max_players) VALUES ($1, $2) RETURNING id`

const updateGameSQL = `UPDATE games SET name = $2, default_max_players = $3 WHERE id = $1`

const deleteGameSQL = `DELETE FROM games WHERE id = $1`

// uniqueViolation is the SQLSTATE of a unique constraint. On games it is only the name index (ADR 0010).
const uniqueViolation = "23505"

// invalidTextRepresentation is the SQLSTATE of a malformed uuid. A malformed ID names no game (ADR 0010).
const invalidTextRepresentation = "22P02"

// gameRepo implements the game list ports of the application layer.
type gameRepo struct{ s *Store }

var (
	_ application.GameCatalog       = gameRepo{}
	_ application.GameCatalogEditor = gameRepo{}
)

// Games returns the game list repository.
func (s *Store) Games() gameRepo { return gameRepo{s} }

// List returns every game, sorted by name ignoring case, then ID. A NULL default max players is returned as nil.
func (r gameRepo) List(ctx context.Context) (games []domain.Game, err error) {
	rows, err := r.s.db.QueryContext(ctx, listGamesSQL)
	if err != nil {
		return nil, translate(err)
	}
	defer func() { err = errors.Join(err, translate(rows.Close())) }()
	for rows.Next() {
		var game domain.Game
		if scanErr := rows.Scan(&game.ID, &game.Name, &game.DefaultMaxPlayers); scanErr != nil {
			return nil, translate(scanErr)
		}
		games = append(games, game)
	}
	return games, translate(rows.Err())
}

// ListForGroup returns every game of the list with no lobby count yet (see the shortcut above).
func (r gameRepo) ListForGroup(ctx context.Context, _ string) ([]application.GameUsage, error) {
	games, err := r.List(ctx)
	if err != nil {
		return nil, err
	}
	usages := make([]application.GameUsage, 0, len(games))
	for _, game := range games {
		usages = append(usages, application.GameUsage{Game: game})
	}
	return usages, nil
}

// Create inserts the game and returns it with the ID the database generated.
func (r gameRepo) Create(ctx context.Context, game domain.Game) (domain.Game, error) {
	if err := r.s.db.QueryRowContext(ctx, insertGameSQL, game.Name, game.DefaultMaxPlayers).Scan(&game.ID); err != nil {
		return domain.Game{}, gameWriteError(err)
	}
	return game, nil
}

// Replace updates the name and default max of the game with the ID. ErrGameNotFound when no game has the ID.
func (r gameRepo) Replace(ctx context.Context, game domain.Game) error {
	result, err := r.s.db.ExecContext(ctx, updateGameSQL, game.ID, game.Name, game.DefaultMaxPlayers)
	if err != nil {
		return gameWriteError(err)
	}
	return requireOneGame(result)
}

// Delete removes the game with the ID. Lobbies have no foreign key to games, so they are not touched (ADR 0010).
func (r gameRepo) Delete(ctx context.Context, id string) error {
	result, err := r.s.db.ExecContext(ctx, deleteGameSQL, id)
	if err != nil {
		return gameWriteError(err)
	}
	return requireOneGame(result)
}

// gameWriteError maps a duplicate name to ErrGameTaken, a malformed ID to ErrGameNotFound, and any other database error
// to its usual translation.
func gameWriteError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case uniqueViolation:
			return application.ErrGameTaken
		case invalidTextRepresentation:
			return application.ErrGameNotFound
		}
	}
	return translate(err)
}

// requireOneGame gives ErrGameNotFound when a write touched no row.
func requireOneGame(result sql.Result) error {
	affected, err := result.RowsAffected()
	if err != nil {
		return translate(err)
	}
	if affected == 0 {
		return application.ErrGameNotFound
	}
	return nil
}
