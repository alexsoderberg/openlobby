package postgres

import (
	"context"
	"database/sql"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// effectiveGameRoleSQL is the rule "effective game role" (ADR 0017 section 2) on a game_roles row named gr: a role of a
// mode, or a role of a game with no modes. domain.Game.EffectiveGameRoles is the same rule, and an integration test keeps
// the two equal (ADR 0022 point 2).
const effectiveGameRoleSQL = `(gr.game_mode_id IS NOT NULL OR NOT EXISTS (SELECT 1 FROM game_modes gm WHERE gm.game_id = gr.game_id))`

// The IDs are sent as text and cast by the database, so an ID that is not a uuid fails as 22P02 inside the transaction.
const (
	selectChosenGameRolesSQL = `SELECT game_role_id FROM preferred_game_roles WHERE user_id = $1`
	// hashtext has 32 bits, so two people can share a lock; that only serializes two unrelated saves (ADR 0022 point 5).
	lockChoicesOfUserSQL     = `SELECT pg_advisory_xact_lock(hashtext($1::text))`
	lockGamesOfGameRolesSQL  = `SELECT id FROM games WHERE id IN (SELECT game_id FROM game_roles WHERE id = ANY($1::text[]::uuid[])) ORDER BY id FOR SHARE`
	lockEffectiveGameRoleSQL = `SELECT gr.id FROM game_roles gr WHERE gr.id = ANY($1::text[]::uuid[]) AND ` + effectiveGameRoleSQL + ` FOR SHARE`
	insertChoicesSQL         = `INSERT INTO preferred_game_roles (user_id, game_role_id) SELECT $1::uuid, unnest($2::text[]::uuid[])`
)

// Every delete of choices locks its rows in key order first, in a subquery, so a save and an admin write never lock two
// choices in opposite orders. A plain DELETE locks in the order of its plan: an index scan by key in the save, a
// sequential scan in physical order in the cleanup, which can deadlock (ADR 0022 point 5).
const (
	deleteChoicesInKeyOrderSQL = `DELETE FROM preferred_game_roles WHERE (user_id, game_role_id) IN
		(SELECT user_id, game_role_id FROM preferred_game_roles p WHERE `
	keyOrderLockSQL = ` ORDER BY user_id, game_role_id FOR UPDATE)`

	deleteChoicesOfUserSQL = deleteChoicesInKeyOrderSQL + `p.user_id = $1` + keyOrderLockSQL
	// deleteOrphanChoicesSQL removes the choices of every game role that no longer exists. Each admin write that can
	// remove a game role runs it in its own transaction (ADR 0022 point 2).
	// shortcut: the cleanup scans the whole choices table, fine while it holds a few rows per member, upgrade to a scan by game when it grows.
	deleteOrphanChoicesSQL = deleteChoicesInKeyOrderSQL +
		`NOT EXISTS (SELECT 1 FROM game_roles gr WHERE gr.id = p.game_role_id)` + keyOrderLockSQL
)

// preferredGameRoleRepo implements the preferred game role port of the application layer.
type preferredGameRoleRepo struct{ s *Store }

var _ application.PreferredGameRoleRepository = preferredGameRoleRepo{}

// PreferredGameRoles returns the preferred game role repository.
func (s *Store) PreferredGameRoles() preferredGameRoleRepo { return preferredGameRoleRepo{s} }

// ChosenGameRoleIDs returns the user's stored game role IDs, hidden choices included.
func (r preferredGameRoleRepo) ChosenGameRoleIDs(ctx context.Context, userID string) ([]string, error) {
	var ids []string
	err := eachRow(ctx, r.s.db, func(rows *sql.Rows) error {
		var id string
		err := rows.Scan(&id)
		ids = append(ids, id)
		return err
	}, selectChosenGameRolesSQL, userID)
	return ids, translate(err)
}

// Replace takes the locks in the order of ADR 0022 point 5: the user's advisory lock, the games in ID order, then the
// game roles, the same game-before-role order as the admin write, so the two never wait on each other in a cycle. The
// share locks keep the roles until commit, so an admin write cannot remove one between the check and the insert.
func (r preferredGameRoleRepo) Replace(ctx context.Context, userID string, gameRoleIDs []string) error {
	err := r.s.inTx(ctx, func(tx *sql.Tx) error {
		effective, err := lockForReplace(ctx, tx, userID, gameRoleIDs)
		if err != nil {
			return err
		}
		if len(effective) != len(gameRoleIDs) {
			return domain.ErrInvalidGameRole
		}
		if _, err := tx.ExecContext(ctx, deleteChoicesOfUserSQL, userID); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, insertChoicesSQL, userID, effective)
		return err
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == invalidTextRepresentation {
		return domain.ErrInvalidGameRole
	}
	return translate(err)
}

// lockForReplace takes steps 1 to 3 of ADR 0022 point 5 in order: the user's advisory lock, the games of the named roles
// in ID order, then the named roles that are effective. It returns those roles' IDs.
func lockForReplace(ctx context.Context, tx *sql.Tx, userID string, gameRoleIDs []string) ([]string, error) {
	if _, err := tx.ExecContext(ctx, lockChoicesOfUserSQL, userID); err != nil {
		return nil, err
	}
	if err := eachRow(ctx, tx, func(*sql.Rows) error { return nil }, lockGamesOfGameRolesSQL, gameRoleIDs); err != nil {
		return nil, err
	}
	var effective []string
	err := eachRow(ctx, tx, func(rows *sql.Rows) error {
		var id string
		err := rows.Scan(&id)
		effective = append(effective, id)
		return err
	}, lockEffectiveGameRoleSQL, gameRoleIDs)
	return effective, err
}

// The choices visible to a member of the group (ADR 0022 point 6), one query per read, never one per person. Only
// effective game roles, in the order of the contract: game name ignoring case, then mode order, then role order.
const (
	selectVisibleChoicesSQL = `SELECT p.user_id, gr.id, gr.name, g.name, gm.name FROM preferred_game_roles p
		JOIN game_roles gr ON gr.id = p.game_role_id
		JOIN games g ON g.id = gr.game_id
		LEFT JOIN game_modes gm ON gm.id = gr.game_mode_id
		WHERE ` + effectiveGameRoleSQL + ` AND `
	visibleChoiceOrderSQL = ` ORDER BY lower(g.name), g.id, gm.sort_order, gm.id, gr.sort_order, gr.id`

	// choicesOfMembersSQL reads the choices of every current member of the group $1.
	choicesOfMembersSQL = selectVisibleChoicesSQL +
		`p.user_id IN (SELECT user_id FROM group_members WHERE group_id = $1)` + visibleChoiceOrderSQL
	// choicesOfLobbyPlayersSQL reads, for the lobby $1, the choices of its game (all modes) of the players who are still
	// members of its group, which hides a former member's row on a past lobby. A lobby with no game matches no role.
	choicesOfLobbyPlayersSQL = selectVisibleChoicesSQL + `gr.game_id = (SELECT game_id FROM lobbies WHERE id = $1)
		AND p.user_id IN (SELECT lp.user_id FROM lobby_players lp JOIN lobbies l ON l.id = lp.lobby_id
			JOIN group_members m ON m.group_id = l.group_id AND m.user_id = lp.user_id WHERE lp.lobby_id = $1)` +
		visibleChoiceOrderSQL
)

// visibleChoicesByUser runs one of the visible-choice queries and groups its rows by person, keeping their order.
func visibleChoicesByUser(ctx context.Context, q queryer, query, id string) (map[string][]domain.PreferredGameRole, error) {
	byUser := map[string][]domain.PreferredGameRole{}
	err := eachRow(ctx, q, func(rows *sql.Rows) error {
		var userID string
		var role domain.PreferredGameRole
		err := rows.Scan(&userID, &role.GameRoleID, &role.Name, &role.GameName, &role.ModeName)
		byUser[userID] = append(byUser[userID], role)
		return err
	}, query, id)
	return byUser, err
}
