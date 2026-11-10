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

// lockGameSQL serializes admin writes to the same game (ADR 0017 section 6).
const lockGameSQL = selectGameSQL + ` FOR UPDATE`

// Lobbies of other groups and lobbies with a custom name (game_id NULL) or a removed game do not join, so they do not count.
const listGroupGamesSQL = `SELECT g.id, g.name, g.default_max_players, g.genre, count(l.id)
	FROM games g LEFT JOIN lobbies l ON l.game_id = g.id AND l.group_id = $1
	GROUP BY g.id ORDER BY lower(g.name), g.id`

// One query per table for the whole game list, not one per game (ADR 0017 Consequences). The owner of a role is its mode
// or, for a role of the game itself, the game.
const (
	selectGameRolesSQL = `SELECT id, COALESCE(game_mode_id, game_id), name, slots FROM game_roles`
	gameRoleOrderSQL   = ` ORDER BY sort_order, id`
	listGameRolesSQL   = selectGameRolesSQL + gameRoleOrderSQL
	selectModeRolesSQL = selectGameRolesSQL + ` WHERE game_mode_id = $1` + gameRoleOrderSQL
	listGameModesSQL   = `SELECT id, game_id, name, max_players FROM game_modes ORDER BY sort_order, id`
	listActivitiesSQL  = `SELECT id, game_mode_id, name FROM activities ORDER BY sort_order, id`
)

const insertGameSQL = `INSERT INTO games (name, default_max_players, genre) VALUES ($1, $2, $3) RETURNING id`

const updateGameSQL = `UPDATE games SET name = $2, default_max_players = $3, genre = $4 WHERE id = $1`

const deleteGameSQL = `DELETE FROM games WHERE id = $1`

// Deleting a mode cascades its game roles and activities. An entry keeps its given id, otherwise the database makes one.
const (
	deleteGameRolesSQL = `DELETE FROM game_roles WHERE game_id = $1 AND game_mode_id IS NULL`
	deleteGameModesSQL = `DELETE FROM game_modes WHERE game_id = $1`
	insertGameRoleSQL  = `INSERT INTO game_roles (id, game_id, game_mode_id, name, slots, sort_order)
		VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6)`
	insertGameModeSQL = `INSERT INTO game_modes (id, game_id, name, max_players, sort_order)
		VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5) RETURNING id`
	insertActivitySQL = `INSERT INTO activities (id, game_mode_id, name, sort_order)
		VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4)`
)

// uniqueViolation is the SQLSTATE of a unique constraint.
const uniqueViolation = "23505"

// invalidTextRepresentation is the SQLSTATE of a malformed uuid. A malformed ID names no game (ADR 0010).
const invalidTextRepresentation = "22P02"

// takenByConstraint translates a unique violation by the name of the index, not only by SQLSTATE (ADR 0017 section 5).
var takenByConstraint = map[string]error{
	"games_name_lower_key":     application.ErrGameTaken,
	"game_modes_game_name_key": application.ErrModeTaken,
	"game_roles_game_name_key": application.ErrGameRoleTaken,
	"game_roles_mode_name_key": application.ErrGameRoleTaken,
	"activities_mode_name_key": application.ErrActivityTaken,
}

// queryer is what the readers need; a connection pool and a transaction both have it.
type queryer interface {
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// gameRepo implements the game list ports of the application layer.
type gameRepo struct{ s *Store }

var (
	_ application.GameCatalog       = gameRepo{}
	_ application.GameCatalogEditor = gameRepo{}
)

// Games returns the game list repository.
func (s *Store) Games() gameRepo { return gameRepo{s} }

// List returns every game with its game roles and modes, sorted by name ignoring case, then ID. A NULL default max
// players is returned as nil.
func (r gameRepo) List(ctx context.Context) ([]domain.Game, error) {
	var games []domain.Game
	err := eachRow(ctx, r.s.db, func(rows *sql.Rows) error {
		var game domain.Game
		err := rows.Scan(&game.ID, &game.Name, &game.DefaultMaxPlayers, &game.Genre)
		games = append(games, game)
		return err
	}, listGamesSQL)
	if err != nil {
		return nil, translate(err)
	}
	pointers := make([]*domain.Game, len(games))
	for i := range games {
		pointers[i] = &games[i]
	}
	return games, translate(attachTree(ctx, r.s.db, pointers))
}

// ListForGroup returns every game of the list, with its game roles and modes, and the number of lobbies the group created with it.
func (r gameRepo) ListForGroup(ctx context.Context, groupID string) ([]application.GameUsage, error) {
	var usages []application.GameUsage
	err := eachRow(ctx, r.s.db, func(rows *sql.Rows) error {
		var usage application.GameUsage
		game := &usage.Game
		err := rows.Scan(&game.ID, &game.Name, &game.DefaultMaxPlayers, &game.Genre, &usage.LobbyCount)
		usages = append(usages, usage)
		return err
	}, listGroupGamesSQL, groupID)
	if err != nil {
		return nil, translate(err)
	}
	pointers := make([]*domain.Game, len(usages))
	for i := range usages {
		pointers[i] = &usages[i].Game
	}
	return usages, translate(attachTree(ctx, r.s.db, pointers))
}

// Find returns the game with its game roles and modes, or ErrGameNotFound when no game has the ID, also when it is not a
// uuid (ADR 0010). The four reads are one snapshot, so a create never sees half of a concurrent admin write.
func (r gameRepo) Find(ctx context.Context, id string) (domain.Game, error) {
	var game domain.Game
	err := r.s.inSnapshot(ctx, func(tx *sql.Tx) (err error) {
		game, err = loadGame(ctx, tx, selectGameSQL, id)
		return err
	})
	if err != nil {
		return domain.Game{}, gameWriteError(err)
	}
	return game, nil
}

// Create inserts the game with its game roles and modes and returns it as stored, with the generated IDs.
func (r gameRepo) Create(ctx context.Context, game domain.Game) (stored domain.Game, err error) {
	err = r.s.inTx(ctx, func(tx *sql.Tx) error {
		if err := game.CheckIDs(domain.Game{}); err != nil {
			return err
		}
		defaultMax, err := game.EffectiveDefaultMax(domain.Game{})
		if err != nil {
			return err
		}
		if err := tx.QueryRowContext(ctx, insertGameSQL, game.Name, defaultMax, game.Genre).Scan(&game.ID); err != nil {
			return err
		}
		if err := writeTree(ctx, tx, game); err != nil {
			return err
		}
		stored, err = loadGame(ctx, tx, selectGameSQL, game.ID)
		return err
	})
	return stored, gameWriteError(err)
}

// Replace updates the game under a lock on its row. ErrGameNotFound when no game has the ID. It reads the stored game
// first, because the identity checks and the default max need it (ADR 0017 section 6).
func (r gameRepo) Replace(ctx context.Context, game domain.Game) (stored domain.Game, err error) {
	err = r.s.inTx(ctx, func(tx *sql.Tx) error {
		current, err := loadGame(ctx, tx, lockGameSQL, game.ID)
		if errors.Is(err, application.ErrGameNotFound) {
			// The default max rule comes before game_not_found (ADR 0017 section 6); an unknown game has no stored roles.
			if _, capacityErr := game.EffectiveDefaultMax(domain.Game{}); capacityErr != nil {
				return capacityErr
			}
		}
		if err != nil {
			return err
		}
		defaultMax, err := game.EffectiveDefaultMax(current)
		if err != nil {
			return err
		}
		if err := game.CheckIDs(current); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, updateGameSQL, game.ID, game.Name, defaultMax, game.Genre); err != nil {
			return err
		}
		if err := writeTree(ctx, tx, game); err != nil {
			return err
		}
		stored, err = loadGame(ctx, tx, selectGameSQL, game.ID)
		return err
	})
	return stored, gameWriteError(err)
}

// Delete removes the game with the ID. Lobbies have no foreign key to games, so they are not touched (ADR 0010).
func (r gameRepo) Delete(ctx context.Context, id string) error {
	result, err := r.s.db.ExecContext(ctx, deleteGameSQL, id)
	if err != nil {
		return gameWriteError(err)
	}
	return requireOneGame(result)
}

// loadGame reads one game with its game roles and modes, or ErrGameNotFound.
func loadGame(ctx context.Context, q queryer, query, id string) (domain.Game, error) {
	var game domain.Game
	err := q.QueryRowContext(ctx, query, id).Scan(&game.ID, &game.Name, &game.DefaultMaxPlayers, &game.Genre)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Game{}, application.ErrGameNotFound
	}
	if err != nil {
		return domain.Game{}, err
	}
	return game, attachTree(ctx, q, []*domain.Game{&game})
}

// attachTree fills GameRoles and Modes (with their roles and activities) of the games, in the order entered. The lists
// are never nil. It reads the three tables whole, because the game list is short. The reads are one snapshot only when q is
// a snapshot transaction (Find); an entry whose game is gone is ignored.
func attachTree(ctx context.Context, q queryer, games []*domain.Game) error {
	rolesByOwner, err := rolesByOwner(ctx, q, listGameRolesSQL)
	if err != nil {
		return err
	}
	activitiesByMode, err := activitiesByMode(ctx, q)
	if err != nil {
		return err
	}
	modesByGame, err := modesByGame(ctx, q, rolesByOwner, activitiesByMode)
	if err != nil {
		return err
	}
	for _, game := range games {
		game.GameRoles = orEmpty(rolesByOwner[game.ID])
		game.Modes = orEmpty(modesByGame[game.ID])
	}
	return nil
}

// rolesByOwner groups the game roles of the query by their owner: the mode, or the game for a role of the game itself.
func rolesByOwner(ctx context.Context, q queryer, query string, args ...any) (map[string][]domain.GameRole, error) {
	roles := map[string][]domain.GameRole{}
	err := eachRow(ctx, q, func(rows *sql.Rows) error {
		var owner string
		var role domain.GameRole
		err := rows.Scan(&role.ID, &owner, &role.Name, &role.Slots)
		roles[owner] = append(roles[owner], role)
		return err
	}, query, args...)
	return roles, err
}

func activitiesByMode(ctx context.Context, q queryer) (map[string][]domain.Activity, error) {
	activities := map[string][]domain.Activity{}
	err := eachRow(ctx, q, func(rows *sql.Rows) error {
		var modeID string
		var activity domain.Activity
		err := rows.Scan(&activity.ID, &modeID, &activity.Name)
		activities[modeID] = append(activities[modeID], activity)
		return err
	}, listActivitiesSQL)
	return activities, err
}

// modesByGame groups every mode by its game, with the roles and activities already read.
func modesByGame(ctx context.Context, q queryer, roles map[string][]domain.GameRole, activities map[string][]domain.Activity) (map[string][]domain.GameMode, error) {
	modes := map[string][]domain.GameMode{}
	err := eachRow(ctx, q, func(rows *sql.Rows) error {
		var gameID string
		mode := domain.GameMode{MaxPlayers: new(int)}
		if err := rows.Scan(&mode.ID, &gameID, &mode.Name, mode.MaxPlayers); err != nil {
			return err
		}
		mode.GameRoles = orEmpty(roles[mode.ID])
		mode.Activities = orEmpty(activities[mode.ID])
		modes[gameID] = append(modes[gameID], mode)
		return nil
	}, listGameModesSQL)
	return modes, err
}

// orEmpty turns a nil list into an empty one, so a read game never looks like "leave unchanged" to a writer.
func orEmpty[T any](list []T) []T {
	if list == nil {
		return []T{}
	}
	return list
}

// eachRow runs a query and gives every row to scan, then closes the rows, so the connection is free for the next query.
func eachRow(ctx context.Context, q queryer, scan func(*sql.Rows) error, query string, args ...any) (err error) {
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer func() { err = errors.Join(err, rows.Close()) }()
	for rows.Next() {
		if err := scan(rows); err != nil {
			return err
		}
	}
	return rows.Err()
}

// writeTree replaces the game roles and modes that the write gives (nil leaves them as they are). It deletes first and
// inserts after, so a swap of two names never meets a unique index half way (ADR 0017 section 6).
func writeTree(ctx context.Context, tx *sql.Tx, game domain.Game) error {
	if game.GameRoles != nil {
		if _, err := tx.ExecContext(ctx, deleteGameRolesSQL, game.ID); err != nil {
			return err
		}
	}
	if game.Modes != nil {
		if _, err := tx.ExecContext(ctx, deleteGameModesSQL, game.ID); err != nil {
			return err
		}
	}
	if err := insertGameRoles(ctx, tx, game.ID, "", game.GameRoles); err != nil {
		return err
	}
	for order, mode := range game.Modes {
		var modeID string
		if err := tx.QueryRowContext(ctx, insertGameModeSQL, nullIfEmpty(mode.ID), game.ID, mode.Name, mode.MaxPlayers, order).Scan(&modeID); err != nil {
			return err
		}
		if err := insertGameRoles(ctx, tx, game.ID, modeID, mode.GameRoles); err != nil {
			return err
		}
		for activityOrder, activity := range mode.Activities {
			if _, err := tx.ExecContext(ctx, insertActivitySQL, nullIfEmpty(activity.ID), modeID, activity.Name, activityOrder); err != nil {
				return err
			}
		}
	}
	return nil
}

// insertGameRoles stores the roles of one owner: the mode when modeID is set, otherwise the game itself.
func insertGameRoles(ctx context.Context, tx *sql.Tx, gameID, modeID string, roles []domain.GameRole) error {
	for order, role := range roles {
		if _, err := tx.ExecContext(ctx, insertGameRoleSQL, nullIfEmpty(role.ID), gameID, nullIfEmpty(modeID), role.Name, role.Slots, order); err != nil {
			return err
		}
	}
	return nil
}

// nullIfEmpty gives NULL for an empty ID, so the database generates one.
func nullIfEmpty(id string) any {
	if id == "" {
		return nil
	}
	return id
}

// gameWriteError maps a unique violation to the "taken" error of its index, a malformed ID to ErrGameNotFound, and any
// other database error to its usual translation.
func gameWriteError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case uniqueViolation:
			if taken, found := takenByConstraint[pgErr.ConstraintName]; found {
				return taken
			}
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
