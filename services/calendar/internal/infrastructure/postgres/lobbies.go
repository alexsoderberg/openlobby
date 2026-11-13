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
	insertLobbySQL = `INSERT INTO lobbies (group_id, created_by_user_id, game_id, game_name, max_players, starts_at, ends_at, created_at,
		game_mode_id, mode_name, activity_id, activity_name)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`
	insertRoleSlotSQL = `INSERT INTO lobby_role_slots (lobby_id, game_role_id, name, slots, sort_order) VALUES ($1, $2, $3, $4, $5)`
	// One statement adds a player and moves an existing one; the join time of a player who moves stays.
	savePlayerSQL = `INSERT INTO lobby_players (lobby_id, user_id, joined_at, game_role_id) VALUES ($1, $2, $3, $4)
		ON CONFLICT (lobby_id, user_id) DO UPDATE SET game_role_id = EXCLUDED.game_role_id`
	selectJoinStateSQL = `SELECT l.ends_at, l.max_players,
		(SELECT count(*) FROM lobby_players p WHERE p.lobby_id = l.id),
		(SELECT p.game_role_id FROM lobby_players p WHERE p.lobby_id = l.id AND p.user_id = $3),
		EXISTS (SELECT 1 FROM lobby_players p WHERE p.lobby_id = l.id AND p.user_id = $3)
		FROM lobbies l WHERE l.id = $1 AND l.group_id = $2`
	selectLobbyFactsSQL = `SELECT l.ends_at, l.game_id, l.game_name IS NOT NULL, l.game_mode_id,
		(SELECT count(*) FROM lobby_players p WHERE p.lobby_id = l.id),
		EXISTS (SELECT 1 FROM lobby_players p WHERE p.lobby_id = l.id AND p.user_id = $3)
		FROM lobbies l WHERE l.id = $1 AND l.group_id = $2`
	selectGameOfListSQL     = `SELECT id, name FROM games WHERE id = $1`
	updateLobbyGameSQL      = `UPDATE lobbies SET game_id = $2, game_name = $3 WHERE id = $1`
	selectModeOfGameSQL     = `SELECT id, name, max_players FROM game_modes WHERE id = $1 AND game_id = $2`
	selectActivityOfModeSQL = `SELECT id, name FROM activities WHERE id = $1 AND game_mode_id = $2`
	// The activity belongs to the old mode, so a mode change clears it.
	updateLobbyModeSQL      = `UPDATE lobbies SET game_mode_id = $2, mode_name = $3, max_players = $4, activity_id = NULL, activity_name = NULL WHERE id = $1`
	deleteLobbyRoleSlotsSQL = `DELETE FROM lobby_role_slots WHERE lobby_id = $1`
	updateLobbyActivitySQL  = `UPDATE lobbies SET activity_id = $2, activity_name = $3 WHERE id = $1`
	deleteLobbyPlayerSQL    = `DELETE FROM lobby_players WHERE lobby_id = $1 AND user_id = $2`
	selectCreatorSQL        = `SELECT created_by_user_id FROM lobbies WHERE id = $1 AND group_id = $2`
	deleteLobbySQL          = `DELETE FROM lobbies WHERE id = $1 AND group_id = $2`

	// The genre is joined from games by id; a removed game or a custom name has no row, so it is NULL (ADR 0016). The player count and the caller check are subqueries on the primary key (lobby_id, user_id); lobbies_group_id_game_id_idx serves group_id.
	selectLobbiesSQL = `SELECT l.id, l.created_by_user_id, l.game_id, l.game_name, g.genre, l.max_players, l.starts_at, l.ends_at, l.created_at,
		l.game_mode_id, l.mode_name, l.activity_id, l.activity_name,
		(SELECT count(*) FROM lobby_players p WHERE p.lobby_id = l.id),
		EXISTS (SELECT 1 FROM lobby_players p WHERE p.lobby_id = l.id AND p.user_id = $3)
		FROM lobbies l LEFT JOIN games g ON g.id = l.game_id WHERE l.group_id = $1 AND l.ends_at > $2`
	listUpcomingSQL  = selectLobbiesSQL + ` ORDER BY l.starts_at, l.id`
	selectLobbySQL   = selectLobbiesSQL + ` AND l.id = $4`
	selectPlayersSQL = `SELECT user_id, game_role_id FROM lobby_players WHERE lobby_id = $1 ORDER BY joined_at, user_id`

	// The role slots with the players in each role: one query for all lobbies of a read, never one per lobby (ADR 0017
	// Consequences). The count reads lobby_players by the prefix lobby_id of its primary key.
	selectRoleSlotsSQL = `SELECT s.lobby_id, s.game_role_id, s.name, s.slots,
		(SELECT count(*) FROM lobby_players p WHERE p.lobby_id = s.lobby_id AND p.game_role_id = s.game_role_id)
		FROM lobby_role_slots s`
	upcomingRoleSlotsSQL = selectRoleSlotsSQL + ` JOIN lobbies l ON l.id = s.lobby_id WHERE l.group_id = $1 AND l.ends_at > $2 ORDER BY s.lobby_id, s.sort_order`
	lobbyRoleSlotsSQL    = selectRoleSlotsSQL + ` WHERE s.lobby_id = $1 ORDER BY s.sort_order`
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

// InsertLobby stores the lobby with its role slots and the creator's player row. All are in the caller's transaction.
func (t lobbyTx) InsertLobby(ctx context.Context, lobby domain.Lobby) (domain.Lobby, error) {
	err := t.tx.QueryRowContext(ctx, insertLobbySQL,
		lobby.GroupID, lobby.CreatedByUserID, lobby.GameID, lobby.GameName, lobby.MaxPlayers, lobby.StartsAt, lobby.EndsAt, lobby.CreatedAt,
		lobby.ModeID, lobby.ModeName, lobby.ActivityID, lobby.ActivityName,
	).Scan(&lobby.ID)
	if err != nil {
		return domain.Lobby{}, err
	}
	// The slots come first: the creator's row refers to one of them.
	for order, slot := range lobby.RoleSlots {
		if _, err := t.tx.ExecContext(ctx, insertRoleSlotSQL, lobby.ID, slot.GameRoleID, slot.Name, slot.Slots, order); err != nil {
			return domain.Lobby{}, err
		}
	}
	_, err = t.tx.ExecContext(ctx, savePlayerSQL, lobby.ID, lobby.CreatedByUserID, lobby.CreatedAt, lobby.CreatorRoleID)
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

// DeleteLobby removes the lobby of this group. The players and role slots go with it (ON DELETE CASCADE).
func (t lobbyTx) DeleteLobby(ctx context.Context, groupID, lobbyID string) error {
	_, err := t.tx.ExecContext(ctx, deleteLobbySQL, lobbyID, groupID)
	return err
}

// Membership returns the user's membership of the group. Not being a member is no error.
func (r lobbyRepo) Membership(ctx context.Context, groupID, userID string) (domain.Member, bool, error) {
	member, found, err := membership(ctx, r.s.db, groupID, userID)
	return member, found, translate(err)
}

// Upcoming returns the lobbies of the group that end after now: one query for the lobbies and one for all their role
// slots. Both are read in one snapshot, so a mode change never shows a new limit with the old slots.
func (r lobbyRepo) Upcoming(ctx context.Context, groupID, callerID string, now time.Time) ([]domain.Lobby, error) {
	var lobbies []domain.Lobby
	err := r.s.inSnapshot(ctx, func(tx *sql.Tx) (err error) {
		lobbies, err = loadUpcoming(ctx, tx, groupID, callerID, now)
		return err
	})
	if err != nil {
		return nil, translate(err)
	}
	return lobbies, nil
}

func loadUpcoming(ctx context.Context, q queryer, groupID, callerID string, now time.Time) ([]domain.Lobby, error) {
	var lobbies []domain.Lobby
	err := eachRow(ctx, q, func(rows *sql.Rows) error {
		lobby, err := scanLobby(rows, groupID)
		lobbies = append(lobbies, lobby)
		return err
	}, listUpcomingSQL, groupID, now, callerID)
	if err != nil {
		return nil, err
	}
	slots, err := roleSlotsByLobby(ctx, q, upcomingRoleSlotsSQL, groupID, now)
	if err != nil {
		return nil, err
	}
	for i := range lobbies {
		lobbies[i] = lobbies[i].WithRoleSlots(slots[lobbies[i].ID])
	}
	return lobbies, nil
}

// Lobby returns the upcoming lobby of this group with its players, or domain.ErrLobbyNotFound. The lobby, its role
// slots and its players are one snapshot, so the players' game roles always match the slots.
func (r lobbyRepo) Lobby(ctx context.Context, groupID, lobbyID, callerID string, now time.Time) (domain.Lobby, []domain.Player, error) {
	var lobby domain.Lobby
	var players []domain.Player
	err := r.s.inSnapshot(ctx, func(tx *sql.Tx) (err error) {
		if lobby, err = loadLobby(ctx, tx, groupID, lobbyID, callerID, now); err != nil {
			return err
		}
		players, err = loadPlayers(ctx, tx, lobby.ID)
		return err
	})
	if err != nil {
		return domain.Lobby{}, nil, translate(err)
	}
	return lobby, players, nil
}

// loadPlayers reads the lobby's players with the preferred game roles that the group may see (ADR 0022 point 6).
func loadPlayers(ctx context.Context, q queryer, lobbyID string) ([]domain.Player, error) {
	var players []domain.Player
	err := eachRow(ctx, q, func(rows *sql.Rows) error {
		var player domain.Player
		err := rows.Scan(&player.UserID, &player.GameRoleID)
		players = append(players, player)
		return err
	}, selectPlayersSQL, lobbyID)
	if err != nil {
		return nil, err
	}
	choices, err := visibleChoicesByUser(ctx, q, choicesOfLobbyPlayersSQL, lobbyID)
	if err != nil {
		return nil, err
	}
	for i := range players {
		players[i].PreferredGameRoles = choices[players[i].UserID]
	}
	return players, nil
}

// loadLobby reads the lobby that ends after now with its role slots, or returns domain.ErrLobbyNotFound.
func loadLobby(ctx context.Context, q queryer, groupID, lobbyID, callerID string, now time.Time) (domain.Lobby, error) {
	lobby, err := scanLobby(q.QueryRowContext(ctx, selectLobbySQL, groupID, now, callerID, lobbyID), groupID)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Lobby{}, domain.ErrLobbyNotFound
	}
	if err != nil {
		return domain.Lobby{}, err
	}
	slots, err := roleSlotsByLobby(ctx, q, lobbyRoleSlotsSQL, lobby.ID)
	if err != nil {
		return domain.Lobby{}, err
	}
	return lobby.WithRoleSlots(slots[lobby.ID]), nil
}

// roleSlotsByLobby reads role slots in the order of the query and groups them by lobby.
func roleSlotsByLobby(ctx context.Context, q queryer, query string, args ...any) (map[string][]domain.RoleSlot, error) {
	slots := map[string][]domain.RoleSlot{}
	err := eachRow(ctx, q, func(rows *sql.Rows) error {
		var lobbyID string
		var slot domain.RoleSlot
		err := rows.Scan(&lobbyID, &slot.GameRoleID, &slot.Name, &slot.Slots, &slot.PlayerCount)
		slots[lobbyID] = append(slots[lobbyID], slot)
		return err
	}, query, args...)
	return slots, err
}

// scanner is implemented by *sql.Row and *sql.Rows.
type scanner interface{ Scan(dest ...any) error }

func scanLobby(row scanner, groupID string) (domain.Lobby, error) {
	lobby := domain.Lobby{GroupID: groupID}
	err := row.Scan(&lobby.ID, &lobby.CreatedByUserID, &lobby.GameID, &lobby.GameName, &lobby.GameGenre, &lobby.MaxPlayers,
		&lobby.StartsAt, &lobby.EndsAt, &lobby.CreatedAt, &lobby.ModeID, &lobby.ModeName, &lobby.ActivityID, &lobby.ActivityName,
		&lobby.PlayerCount, &lobby.JoinedByMe)
	return lobby, err
}

// JoinState reads the join facts under the group lock, so the counts cannot change before SavePlayer.
func (t lobbyTx) JoinState(ctx context.Context, groupID, lobbyID, userID string) (domain.JoinState, bool, error) {
	var state domain.JoinState
	err := t.tx.QueryRowContext(ctx, selectJoinStateSQL, lobbyID, groupID, userID).
		Scan(&state.EndsAt, &state.MaxPlayers, &state.PlayerCount, &state.CurrentRole, &state.IsPlayer)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return domain.JoinState{}, false, nil
	case err != nil:
		return domain.JoinState{}, false, err
	}
	slots, err := roleSlotsByLobby(ctx, t.tx, lobbyRoleSlotsSQL, lobbyID)
	state.Roles = slots[lobbyID]
	return state, true, err
}

// SavePlayer adds the user to the lobby in the game role (nil is flex), or moves a player to it.
func (t lobbyTx) SavePlayer(ctx context.Context, lobbyID, userID string, gameRoleID *string, joinedAt time.Time) error {
	_, err := t.tx.ExecContext(ctx, savePlayerSQL, lobbyID, userID, joinedAt, gameRoleID)
	return err
}

func (t lobbyTx) RemovePlayer(ctx context.Context, lobbyID, userID string) error {
	_, err := t.tx.ExecContext(ctx, deleteLobbyPlayerSQL, lobbyID, userID)
	return err
}

// LobbyFacts reads the lobby, the player count and the caller's player row under the group lock.
func (t lobbyTx) LobbyFacts(ctx context.Context, groupID, lobbyID, userID string) (domain.LobbyFacts, bool, error) {
	var facts domain.LobbyFacts
	err := t.tx.QueryRowContext(ctx, selectLobbyFactsSQL, lobbyID, groupID, userID).
		Scan(&facts.EndsAt, &facts.GameID, &facts.HasGame, &facts.ModeID, &facts.PlayerCount, &facts.IsPlayer)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return domain.LobbyFacts{}, false, nil
	case err != nil:
		return domain.LobbyFacts{}, false, err
	}
	return facts, true, nil
}

// GameOfList reads the game's ID and name in the caller's transaction.
func (t lobbyTx) GameOfList(ctx context.Context, gameID string) (domain.Game, bool, error) {
	var game domain.Game
	err := t.tx.QueryRowContext(ctx, selectGameOfListSQL, gameID).Scan(&game.ID, &game.Name)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return domain.Game{}, false, nil
	case err != nil:
		return domain.Game{}, false, err
	}
	return game, true, nil
}

// SetLobbyGame copies the game's ID and name into the lobby.
func (t lobbyTx) SetLobbyGame(ctx context.Context, lobbyID string, game domain.Game) error {
	_, err := t.tx.ExecContext(ctx, updateLobbyGameSQL, lobbyID, game.ID, game.Name)
	return err
}

// ModeOfGame reads the mode of the game with its game roles in the caller's transaction.
func (t lobbyTx) ModeOfGame(ctx context.Context, gameID, modeID string) (domain.GameMode, bool, error) {
	var mode domain.GameMode
	err := t.tx.QueryRowContext(ctx, selectModeOfGameSQL, modeID, gameID).Scan(&mode.ID, &mode.Name, &mode.MaxPlayers)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return domain.GameMode{}, false, nil
	case err != nil:
		return domain.GameMode{}, false, err
	}
	roles, err := rolesByOwner(ctx, t.tx, selectModeRolesSQL, modeID)
	if err != nil {
		return domain.GameMode{}, false, err
	}
	mode.GameRoles = roles[modeID]
	return mode, true, nil
}

// ActivityOfMode reads the activity of the mode in the caller's transaction.
func (t lobbyTx) ActivityOfMode(ctx context.Context, modeID, activityID string) (domain.Activity, bool, error) {
	var activity domain.Activity
	err := t.tx.QueryRowContext(ctx, selectActivityOfModeSQL, activityID, modeID).Scan(&activity.ID, &activity.Name)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return domain.Activity{}, false, nil
	case err != nil:
		return domain.Activity{}, false, err
	}
	return activity, true, nil
}

// SetLobbyMode writes the mode change. Removing the old role slots sets the players' game roles to NULL by the foreign key
// (ADR 0017 section 1), so every player is flex; the new slots start empty.
func (t lobbyTx) SetLobbyMode(ctx context.Context, lobbyID string, change domain.ModeChange) error {
	if _, err := t.tx.ExecContext(ctx, updateLobbyModeSQL, lobbyID, change.Mode.ID, change.Mode.Name, change.MaxPlayers); err != nil {
		return err
	}
	if _, err := t.tx.ExecContext(ctx, deleteLobbyRoleSlotsSQL, lobbyID); err != nil {
		return err
	}
	for order, slot := range change.Slots {
		if _, err := t.tx.ExecContext(ctx, insertRoleSlotSQL, lobbyID, slot.GameRoleID, slot.Name, slot.Slots, order); err != nil {
			return err
		}
	}
	return nil
}

// SetLobbyActivity sets the activity, or clears both columns when it is nil.
func (t lobbyTx) SetLobbyActivity(ctx context.Context, lobbyID string, activity *domain.Activity) error {
	var id, name *string
	if activity != nil {
		id, name = &activity.ID, &activity.Name
	}
	_, err := t.tx.ExecContext(ctx, updateLobbyActivitySQL, lobbyID, id, name)
	return err
}

// ReadLobby reads the lobby with its role slots in the caller transaction, after a write. The zero time as "now" lets a
// lobby that has just ended be read: the answer to a saved change must not depend on the clock.
func (t lobbyTx) ReadLobby(ctx context.Context, groupID, lobbyID, callerID string) (domain.Lobby, error) {
	return loadLobby(ctx, t.tx, groupID, lobbyID, callerID, time.Time{})
}
