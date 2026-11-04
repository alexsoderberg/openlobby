package postgres

import (
	"context"
	"database/sql"
	"errors"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	insertLobbySQL = `INSERT INTO lobbies (group_id, created_by_user_id, game_id, game_name, max_players, starts_at, ends_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`
	insertLobbyPlayerSQL = `INSERT INTO lobby_players (lobby_id, user_id, joined_at) VALUES ($1, $2, $3)`
	selectCreatorSQL     = `SELECT created_by_user_id FROM lobbies WHERE id = $1 AND group_id = $2`
	deleteLobbySQL       = `DELETE FROM lobbies WHERE id = $1 AND group_id = $2`
)

// lobbyRepo implements the lobby port of the application layer.
type lobbyRepo struct{ s *Store }

var (
	_ application.LobbyRepository = lobbyRepo{}
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
