package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// The order is the system admin's list order (ADR 0010); the group order is decided in application.
const listGamesSQL = `SELECT id, name, default_max_players, genre FROM games ORDER BY lower(name), id`

const selectGameSQL = `SELECT id, name, default_max_players, genre FROM games WHERE id = $1`

// Lobbies of other groups and lobbies with a custom name (game_id NULL) or a removed game do not join, so they do not count.
const listGroupGamesSQL = `SELECT g.id, g.name, g.default_max_players, g.genre, count(l.id)
	FROM games g LEFT JOIN lobbies l ON l.game_id = g.id AND l.group_id = $1
	GROUP BY g.id ORDER BY lower(g.name), g.id`

const insertGameSQL = `INSERT INTO games (name, default_max_players, genre) VALUES ($1, $2, $3) RETURNING id`

const updateGameSQL = `UPDATE games SET name = $2, default_max_players = $3, genre = $4 WHERE id = $1`

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
		if scanErr := rows.Scan(&game.ID, &game.Name, &game.DefaultMaxPlayers, &game.Genre); scanErr != nil {
			return nil, translate(scanErr)
		}
		games = append(games, game)
	}
	return games, translate(rows.Err())
}

// ListForGroup returns every game of the list with the number of lobbies the group created with it.
func (r gameRepo) ListForGroup(ctx context.Context, groupID string) (usages []application.GameUsage, err error) {
	rows, err := r.s.db.QueryContext(ctx, listGroupGamesSQL, groupID)
	if err != nil {
		return nil, translate(err)
	}
	defer func() { err = errors.Join(err, translate(rows.Close())) }()
	for rows.Next() {
		var usage application.GameUsage
		game := &usage.Game
		if scanErr := rows.Scan(&game.ID, &game.Name, &game.DefaultMaxPlayers, &game.Genre, &usage.LobbyCount); scanErr != nil {
			return nil, translate(scanErr)
		}
		usages = append(usages, usage)
	}
	return usages, translate(rows.Err())
}

// Find returns the game, or ErrGameNotFound when no game has the ID, also when it is not a uuid (ADR 0010).
func (r gameRepo) Find(ctx context.Context, id string) (domain.Game, error) {
	var game domain.Game
	err := r.s.db.QueryRowContext(ctx, selectGameSQL, id).Scan(&game.ID, &game.Name, &game.DefaultMaxPlayers, &game.Genre)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return domain.Game{}, application.ErrGameNotFound
	case err != nil:
		return domain.Game{}, gameWriteError(err)
	}
	return game, nil
}

// Create inserts the game and returns it with the ID the database generated.
func (r gameRepo) Create(ctx context.Context, game domain.Game) (domain.Game, error) {
	if err := r.s.db.QueryRowContext(ctx, insertGameSQL, game.Name, game.DefaultMaxPlayers, game.Genre).Scan(&game.ID); err != nil {
		return domain.Game{}, gameWriteError(err)
	}
	return game, nil
}

// Replace updates the name, default max and genre of the game with the ID. ErrGameNotFound when no game has the ID.
func (r gameRepo) Replace(ctx context.Context, game domain.Game) error {
	result, err := r.s.db.ExecContext(ctx, updateGameSQL, game.ID, game.Name, game.DefaultMaxPlayers, game.Genre)
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
