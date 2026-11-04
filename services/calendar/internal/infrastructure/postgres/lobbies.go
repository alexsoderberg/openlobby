package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	insertLobbySQL = `INSERT INTO lobbies (group_id, created_by_user_id, game_id, game_name, max_players, starts_at, ends_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`
	insertLobbyPlayerSQL = `INSERT INTO lobby_players (lobby_id, user_id, joined_at) VALUES ($1, $2, $3)`
	selectCreatorSQL     = `SELECT created_by_user_id FROM lobbies WHERE id = $1 AND group_id = $2`
	deleteLobbySQL       = `DELETE FROM lobbies WHERE id = $1 AND group_id = $2`

	// The player count is a subquery on the primary key (lobby_id, user_id); lobbies_group_id_game_id_idx serves group_id.
	selectLobbiesSQL = `SELECT l.id, l.created_by_user_id, l.game_id, l.game_name, l.max_players, l.starts_at, l.ends_at, l.created_at,
		(SELECT count(*) FROM lobby_players p WHERE p.lobby_id = l.id)
		FROM lobbies l WHERE l.group_id = $1 AND l.ends_at > $2`
	listUpcomingSQL  = selectLobbiesSQL + ` ORDER BY l.starts_at, l.id`
	selectLobbySQL   = selectLobbiesSQL + ` AND l.id = $3`
	selectPlayersSQL = `SELECT user_id FROM lobby_players WHERE lobby_id = $1 ORDER BY joined_at, user_id`
)

// lobbyRepo implements the lobby port of the application layer.
type lobbyRepo struct{ s *Store }

var (
	_ application.LobbyRepository = lobbyRepo{}
	_ application.LobbyReader     = lobbyRepo{}
	_ application.LobbyTx         = lobbyTx{}
)

// Lobbies returns the lobby repository.
func (s *Store) Lobbies() lobbyRepo { return lobbyRepo{s} }

// WithLockedGroup runs fn in one transaction that holds the group's row lock (ADR 0006).
func (r lobbyRepo) WithLockedGroup(ctx context.Context, groupID string, fn func(application.LobbyTx) error) error {
	return r.s.withGroupLock(ctx, groupID, func(tx *sql.Tx) error { return fn(lobbyTx{tx}) })
}

// lobbyTx is the transaction of lobbyRepo.WithLockedGroup. Its methods return the database's errors unchanged;
// withGroupLock translates them once.
type lobbyTx struct{ tx *sql.Tx }

func (t lobbyTx) Membership(ctx context.Context, groupID, userID string) (domain.Member, bool, error) {
	return membership(ctx, t.tx, groupID, userID)
}

// InsertLobby stores the lobby and the creator's player row. Both are in the caller's transaction.
func (t lobbyTx) InsertLobby(ctx context.Context, lobby domain.Lobby) (domain.Lobby, error) {
	err := t.tx.QueryRowContext(ctx, insertLobbySQL,
		lobby.GroupID, lobby.CreatedByUserID, lobby.GameID, lobby.GameName, lobby.MaxPlayers, lobby.StartsAt, lobby.EndsAt, lobby.CreatedAt,
	).Scan(&lobby.ID)
	if err != nil {
		return domain.Lobby{}, err
	}
	_, err = t.tx.ExecContext(ctx, insertLobbyPlayerSQL, lobby.ID, lobby.CreatedByUserID, lobby.CreatedAt)
	return lobby, err
}

// CreatorOf returns the creator of the lobby, and false when the group has no such lobby.
func (t lobbyTx) CreatorOf(ctx context.Context, groupID, lobbyID string) (string, bool, error) {
	var creatorID string
	err := t.tx.QueryRowContext(ctx, selectCreatorSQL, lobbyID, groupID).Scan(&creatorID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return "", false, nil
	case err != nil:
		return "", false, err
	}
	return creatorID, true, nil
}

// DeleteLobby removes the lobby of this group. The players go with it (ON DELETE CASCADE).
func (t lobbyTx) DeleteLobby(ctx context.Context, groupID, lobbyID string) error {
	_, err := t.tx.ExecContext(ctx, deleteLobbySQL, lobbyID, groupID)
	return err
}

// Membership returns the user's membership of the group. Not being a member is no error.
func (r lobbyRepo) Membership(ctx context.Context, groupID, userID string) (domain.Member, bool, error) {
	member, found, err := membership(ctx, r.s.db, groupID, userID)
	return member, found, translate(err)
}

// Upcoming returns the lobbies of the group that end after now, in one query.
func (r lobbyRepo) Upcoming(ctx context.Context, groupID string, now time.Time) (lobbies []domain.Lobby, err error) {
	rows, err := r.s.db.QueryContext(ctx, listUpcomingSQL, groupID, now)
	if err != nil {
		return nil, translate(err)
	}
	defer func() { err = errors.Join(err, translate(rows.Close())) }()
	for rows.Next() {
		lobby, scanErr := scanLobby(rows, groupID)
		if scanErr != nil {
			return nil, translate(scanErr)
		}
		lobbies = append(lobbies, lobby)
	}
	return lobbies, translate(rows.Err())
}

// Lobby returns the upcoming lobby of this group, or domain.ErrLobbyNotFound.
func (r lobbyRepo) Lobby(ctx context.Context, groupID, lobbyID string, now time.Time) (domain.Lobby, error) {
	lobby, err := scanLobby(r.s.db.QueryRowContext(ctx, selectLobbySQL, groupID, now, lobbyID), groupID)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return domain.Lobby{}, domain.ErrLobbyNotFound
	case err != nil:
		return domain.Lobby{}, translate(err)
	}
	return lobby, nil
}

// PlayerIDs returns the user IDs of the lobby's players, in join order.
func (r lobbyRepo) PlayerIDs(ctx context.Context, lobbyID string) (ids []string, err error) {
	rows, err := r.s.db.QueryContext(ctx, selectPlayersSQL, lobbyID)
	if err != nil {
		return nil, translate(err)
	}
	defer func() { err = errors.Join(err, translate(rows.Close())) }()
	for rows.Next() {
		var id string
		if scanErr := rows.Scan(&id); scanErr != nil {
			return nil, translate(scanErr)
		}
		ids = append(ids, id)
	}
	return ids, translate(rows.Err())
}

// scanner is implemented by *sql.Row and *sql.Rows.
type scanner interface{ Scan(dest ...any) error }

func scanLobby(row scanner, groupID string) (domain.Lobby, error) {
	lobby := domain.Lobby{GroupID: groupID}
	err := row.Scan(&lobby.ID, &lobby.CreatedByUserID, &lobby.GameID, &lobby.GameName, &lobby.MaxPlayers,
		&lobby.StartsAt, &lobby.EndsAt, &lobby.CreatedAt, &lobby.PlayerCount)
	return lobby, err
}
