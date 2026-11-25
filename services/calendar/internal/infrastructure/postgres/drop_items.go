package postgres

import (
	"context"
	"database/sql"
	"errors"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	gameExistsSQL = `SELECT 1 FROM games WHERE id = $1`
	// shareGameSQL makes a drop-list write wait for an admin write of the game (FOR UPDATE in Replace and Delete), so the
	// activity check sees the tree as committed and no game delete runs between the check and the write.
	shareGameSQL      = gameExistsSQL + ` FOR SHARE`
	activityOfGameSQL = `SELECT EXISTS (SELECT 1 FROM activities a JOIN game_modes m ON m.id = a.game_mode_id
		WHERE m.game_id = $1 AND a.id = $2)`
	// The game's order is the order of the game read: modes, then their activities, then each drop list.
	listDropsSQL = `SELECT d.item_id, a.id, a.name, m.name FROM drop_items d
		JOIN activities a ON a.id = d.activity_id JOIN game_modes m ON m.id = a.game_mode_id
		WHERE m.game_id = $1 ORDER BY m.sort_order, m.id, a.sort_order, a.id, d.sort_order, d.item_id`
	// A new entry goes after the last one of its activity, computed in the same statement (ADR 0029 section 5).
	insertDropSQL = `INSERT INTO drop_items (activity_id, item_id, sort_order)
		SELECT $1, $2, COALESCE(max(sort_order) + 1, 0) FROM drop_items WHERE activity_id = $1`
	deleteDropSQL     = `DELETE FROM drop_items WHERE activity_id = $1 AND item_id = $2`
	itemReferencedSQL = `SELECT EXISTS (SELECT 1 FROM drop_items WHERE item_id = $1) OR EXISTS (SELECT 1 FROM goals WHERE item_id = $1)`
	// deleteOrphanDropsSQL removes the drop lists of removed activities. Drop lists are not part of the game tree, so it
	// runs after the tree is written and after a game delete (ADR 0017 Amendment 2026-11-25).
	deleteOrphanDropsSQL = `DELETE FROM drop_items d WHERE NOT EXISTS (SELECT 1 FROM activities a WHERE a.id = d.activity_id)`
)

// dropListRepo implements application.DropListRepository. It stores item IDs only (ADR 0029 C1).
type dropListRepo struct{ s *Store }

var _ application.DropListRepository = dropListRepo{}

// DropLists returns the drop list repository.
func (s *Store) DropLists() dropListRepo { return dropListRepo{s} }

// Drops reads the game's drop-list entries in one snapshot with the checks of the game and the activity.
func (r dropListRepo) Drops(ctx context.Context, gameID, activityID string) (drops []domain.Drop, err error) {
	err = r.s.inSnapshot(ctx, func(tx *sql.Tx) error {
		if err := requireGameActivity(ctx, tx, gameExistsSQL, gameID, activityID); err != nil {
			return err
		}
		return eachRow(ctx, tx, func(rows *sql.Rows) error {
			var drop domain.Drop
			activity := &drop.Activity
			err := rows.Scan(&drop.ItemID, &activity.ActivityID, &activity.ActivityName, &activity.ModeName)
			drops = append(drops, drop)
			return err
		}, listDropsSQL, gameID)
	})
	return drops, gameWriteError(err)
}

// AddDrop puts the item at the end of the drop list; the primary key gives ErrDropItemTaken.
func (r dropListRepo) AddDrop(ctx context.Context, gameID, activityID string, itemID domain.ItemID) error {
	return r.write(ctx, gameID, activityID, insertDropSQL, itemID)
}

// RemoveDrop takes the item off the drop list; an item that is not on it is no error.
func (r dropListRepo) RemoveDrop(ctx context.Context, gameID, activityID string, itemID domain.ItemID) error {
	return r.write(ctx, gameID, activityID, deleteDropSQL, itemID)
}

// IsReferenced tells whether the item is on a drop list or in a goal.
func (r dropListRepo) IsReferenced(ctx context.Context, itemID domain.ItemID) (bool, error) {
	var referenced bool
	err := r.s.db.QueryRowContext(ctx, itemReferencedSQL, itemID).Scan(&referenced)
	return referenced, translate(err)
}

func (r dropListRepo) write(ctx context.Context, gameID, activityID, statement string, itemID domain.ItemID) error {
	err := r.s.inTx(ctx, func(tx *sql.Tx) error {
		if err := requireGameActivity(ctx, tx, shareGameSQL, gameID, activityID); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, statement, activityID, itemID)
		return err
	})
	return gameWriteError(err)
}

// requireGameActivity gives ErrGameNotFound for an unknown game, then domain.ErrInvalidActivity when the activity is
// given and is not one of the game.
func requireGameActivity(ctx context.Context, q queryer, gameSQL, gameID, activityID string) error {
	err := q.QueryRowContext(ctx, gameSQL, gameID).Scan(new(int))
	if errors.Is(err, sql.ErrNoRows) {
		return application.ErrGameNotFound
	}
	if err != nil || activityID == "" {
		return err
	}
	var isActivity bool
	if err := q.QueryRowContext(ctx, activityOfGameSQL, gameID, activityID).Scan(&isActivity); err != nil {
		return err
	}
	if !isActivity {
		return domain.ErrInvalidActivity
	}
	return nil
}
