package postgres

import (
	"context"
	"database/sql"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	// The games of the goal list: a goal of the user or a drop-list item, in the order of the game list (ADR 0029 section 5).
	goalGamesSQL = `SELECT g.id, g.name, logo.version FROM games g` + joinImagesSQL + `
		WHERE EXISTS (SELECT 1 FROM goals o WHERE o.user_id = $1 AND o.game_id = g.id)
		OR EXISTS (SELECT 1 FROM ` + dropsOfGameSQL + ` WHERE m.game_id = g.id)
		ORDER BY lower(g.name), g.id`
	// Each goal of the user with every activity of its game whose drop list has the item, in the game's order; a goal
	// on no drop list has one row with no activity. drop_items_item_id_idx serves the join on the item.
	userGoalsSQL = `SELECT o.game_id, o.item_id, a.id, a.name, m.name FROM goals o
		LEFT JOIN (` + dropsOfGameSQL + `) ON d.item_id = o.item_id AND m.game_id = o.game_id
		WHERE o.user_id = $1 ORDER BY o.game_id, o.item_id, ` + activityOrderSQL
	// An existing goal needs no drop-list check (ADR 0029 Amendment 2026-11-25 item 10).
	goalOrItemOnDropListSQL = `SELECT EXISTS (SELECT 1 FROM goals WHERE user_id = $3 AND game_id = $1 AND item_id = $2)
		OR EXISTS (SELECT 1 FROM ` + dropsOfGameSQL + ` WHERE m.game_id = $1 AND d.item_id = $2)`
	insertGoalSQL = `INSERT INTO goals (user_id, game_id, item_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`
	deleteGoalSQL = `DELETE FROM goals WHERE user_id = $1 AND game_id = $2 AND item_id = $3`
	// The goals that the lobby read shows: the player's goals of the lobby's game whose item is on the drop list of the
	// lobby's activity, for players who are still members of the group. A lobby with no game or no activity matches
	// none. The goals primary key (user_id, game_id, item_id) serves the join.
	goalsOfLobbyPlayersSQL = `SELECT o.user_id, o.item_id FROM lobbies l
		JOIN lobby_players p ON p.lobby_id = l.id
		JOIN group_members gm ON gm.group_id = l.group_id AND gm.user_id = p.user_id
		JOIN goals o ON o.user_id = p.user_id AND o.game_id = l.game_id
		JOIN drop_items d ON d.activity_id = l.activity_id AND d.item_id = o.item_id
		WHERE l.id = $1 ORDER BY o.user_id, o.item_id`
)

// goalRepo implements application.GoalRepository. It stores item IDs only (ADR 0029 C1).
type goalRepo struct{ s *Store }

var _ application.GoalRepository = goalRepo{}

// Goals returns the goal repository.
func (s *Store) Goals() goalRepo { return goalRepo{s} }

// GameGoals reads the games and the user's goals in one snapshot.
func (r goalRepo) GameGoals(ctx context.Context, userID string) (games []domain.GameGoals, err error) {
	err = r.s.inSnapshot(ctx, func(tx *sql.Tx) error {
		if err := eachRow(ctx, tx, func(rows *sql.Rows) error {
			game := domain.GameGoals{Goals: []domain.GameItem{}}
			err := rows.Scan(&game.GameID, &game.GameName, &game.GameLogoVersion)
			games = append(games, game)
			return err
		}, goalGamesSQL, userID); err != nil {
			return err
		}
		goals, err := userGoals(ctx, tx, userID)
		if err != nil {
			return err
		}
		for k := range games {
			games[k].Goals = append(games[k].Goals, goals[games[k].GameID]...)
		}
		return nil
	})
	return games, translate(err)
}

// userGoals reads the user's goals by game, each item once with the activities that drop it.
func userGoals(ctx context.Context, q queryer, userID string) (map[string][]domain.GameItem, error) {
	byGame := map[string][]domain.GameItem{}
	err := eachRow(ctx, q, func(rows *sql.Rows) error {
		var gameID string
		var itemID domain.ItemID
		var activityID, activityName, modeName sql.NullString
		if err := rows.Scan(&gameID, &itemID, &activityID, &activityName, &modeName); err != nil {
			return err
		}
		goals := byGame[gameID]
		if len(goals) == 0 || goals[len(goals)-1].ID != itemID {
			goals = append(goals, domain.GameItem{Item: domain.Item{ID: itemID}, DropsIn: []domain.DropActivity{}})
		}
		if activityID.Valid {
			last := &goals[len(goals)-1]
			last.DropsIn = append(last.DropsIn, domain.DropActivity{ActivityID: activityID.String, ActivityName: activityName.String, ModeName: modeName.String})
		}
		byGame[gameID] = goals
		return nil
	}, userGoalsSQL, userID)
	return byGame, err
}

// AddGoal shares the game row, so no admin write or delete of the game runs between the drop-list check and the insert.
// An existing goal is kept as it is, whatever the drop lists hold now.
func (r goalRepo) AddGoal(ctx context.Context, userID, gameID string, itemID domain.ItemID) error {
	err := r.s.inTx(ctx, func(tx *sql.Tx) error {
		if err := requireGameActivity(ctx, tx, shareGameSQL, gameID, ""); err != nil {
			return err
		}
		var allowed bool
		if err := tx.QueryRowContext(ctx, goalOrItemOnDropListSQL, gameID, itemID, userID).Scan(&allowed); err != nil {
			return err
		}
		if !allowed {
			return domain.ErrInvalidItem
		}
		_, err := tx.ExecContext(ctx, insertGoalSQL, userID, gameID, itemID)
		return err
	})
	return gameWriteError(err)
}

// RemoveGoal deletes the goal of a game that exists; a missing goal is no error.
func (r goalRepo) RemoveGoal(ctx context.Context, userID, gameID string, itemID domain.ItemID) error {
	err := r.s.inTx(ctx, func(tx *sql.Tx) error {
		if err := requireGameActivity(ctx, tx, gameExistsSQL, gameID, ""); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, deleteGoalSQL, userID, gameID, itemID)
		return err
	})
	return gameWriteError(err)
}

// goalsOfLobbyPlayers reads the goals that the lobby read shows, by user, with item IDs only.
func goalsOfLobbyPlayers(ctx context.Context, q queryer, lobbyID string) (map[string][]domain.Item, error) {
	byUser := map[string][]domain.Item{}
	err := eachRow(ctx, q, func(rows *sql.Rows) error {
		var userID string
		var item domain.Item
		if err := rows.Scan(&userID, &item.ID); err != nil {
			return err
		}
		byUser[userID] = append(byUser[userID], item)
		return nil
	}, goalsOfLobbyPlayersSQL, lobbyID)
	return byUser, err
}
