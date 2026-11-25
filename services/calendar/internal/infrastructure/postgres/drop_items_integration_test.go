//go:build integration

package postgres

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

func dropItemIDs(drops []domain.Drop) []domain.ItemID {
	ids := make([]domain.ItemID, 0, len(drops))
	for _, drop := range drops {
		ids = append(ids, drop.ItemID)
	}
	return ids
}

func mustAddDrop(t *testing.T, store *Store, gameID, activityID string, itemID domain.ItemID) {
	t.Helper()
	if err := store.DropLists().AddDrop(context.Background(), gameID, activityID, itemID); err != nil {
		t.Fatalf("add %d: %v", itemID, err)
	}
}

func mustDrops(t *testing.T, store *Store, gameID, activityID string) []domain.Drop {
	t.Helper()
	drops, err := store.DropLists().Drops(context.Background(), gameID, activityID)
	if err != nil {
		t.Fatalf("drops: %v", err)
	}
	return drops
}

// Entries are in the game's order, each list in the order added; the checks refuse what the contract refuses.
func TestDropListsKeepTheGameOrderAndRefuseWhatTheContractRefuses(t *testing.T) {
	store := migratedStore(t)
	game := createRaidGame(t, store)
	castle, vault := game.Modes[1].Activities[0], game.Modes[1].Activities[1]
	ctx := context.Background()
	other, err := store.Games().Create(ctx, domain.Game{Name: "Other Game"})
	if err != nil {
		t.Fatal(err)
	}
	mustAddDrop(t, store, game.ID, vault.ID, 30)
	mustAddDrop(t, store, game.ID, castle.ID, 20)
	mustAddDrop(t, store, game.ID, castle.ID, 10)
	mustAddDrop(t, store, game.ID, vault.ID, 20)

	drops := mustDrops(t, store, game.ID, "")

	if got := dropItemIDs(drops); !reflect.DeepEqual(got, []domain.ItemID{20, 10, 30, 20}) {
		t.Fatalf("order %v; want castle (20, 10), then vault (30, 20)", got)
	}
	if drops[0].Activity != (domain.DropActivity{ActivityID: castle.ID, ActivityName: "Castle", ModeName: "Raid"}) {
		t.Fatalf("activity %+v; want Castle of Raid", drops[0].Activity)
	}
	for name, err := range map[string]error{
		"taken":            store.DropLists().AddDrop(ctx, game.ID, castle.ID, 10),
		"foreign activity": store.DropLists().AddDrop(ctx, other.ID, castle.ID, 1),
		"unknown game":     store.DropLists().RemoveDrop(ctx, nobodyID, castle.ID, 1),
	} {
		want := map[string]error{"taken": application.ErrDropItemTaken, "foreign activity": domain.ErrInvalidActivity, "unknown game": application.ErrGameNotFound}[name]
		if !errors.Is(err, want) {
			t.Errorf("%s: %v, want %v", name, err, want)
		}
	}
	if _, err := store.DropLists().Drops(ctx, other.ID, vault.ID); !errors.Is(err, domain.ErrInvalidActivity) {
		t.Errorf("read of a foreign activity: %v; want ErrInvalidActivity", err)
	}
	for range 2 {
		if err := store.DropLists().RemoveDrop(ctx, game.ID, castle.ID, 20); err != nil {
			t.Fatalf("remove: %v; want idempotent", err)
		}
	}
	if got := dropItemIDs(mustDrops(t, store, game.ID, castle.ID)); !reflect.DeepEqual(got, []domain.ItemID{10, 30, 20}) {
		t.Fatalf("drops %v; want castle (10), then vault (30, 20)", got)
	}
}

// A save keeps the drop list of a kept activity, and removes the one of a removed activity; a game delete removes all
// (ADR 0017 Amendment 2026-11-25, ADR 0029 section 3).
func TestTheGameWriteAndDeleteRemoveOrphanDropLists(t *testing.T) {
	store := migratedStore(t)
	game := createRaidGame(t, store)
	castle, vault := game.Modes[1].Activities[0], game.Modes[1].Activities[1]
	ctx := context.Background()
	mustAddDrop(t, store, game.ID, castle.ID, 1)
	mustAddDrop(t, store, game.ID, vault.ID, 2)

	unchanged := game
	unchanged.GameRoles, unchanged.Modes = nil, nil
	if _, err := store.Games().Replace(ctx, unchanged); err != nil {
		t.Fatal(err)
	}
	if got := dropItemIDs(mustDrops(t, store, game.ID, "")); !reflect.DeepEqual(got, []domain.ItemID{1, 2}) {
		t.Fatalf("after a save without the tree: %v; want both kept", got)
	}

	game.Modes[1].Activities = []domain.Activity{castle}
	if _, err := store.Games().Replace(ctx, game); err != nil {
		t.Fatal(err)
	}
	if got := dropItemIDs(mustDrops(t, store, game.ID, "")); !reflect.DeepEqual(got, []domain.ItemID{1}) {
		t.Fatalf("after removing the vault: %v; want only the castle's item", got)
	}
	if rows := count(t, store, `SELECT count(*) FROM drop_items`); rows != 1 {
		t.Fatalf("%d drop rows; want the vault's row deleted", rows)
	}

	if err := store.Games().Delete(ctx, game.ID); err != nil {
		t.Fatal(err)
	}
	if rows := count(t, store, `SELECT count(*) FROM drop_items`); rows != 0 {
		t.Fatalf("%d drop rows after the game delete; want none", rows)
	}
}

// The icon route answers for an item on a drop list or in a goal only (ADR 0029 section 8).
func TestIsReferencedSeesDropListsAndGoals(t *testing.T) {
	store := migratedStore(t)
	game := createRaidGame(t, store)
	ctx := context.Background()
	mustAddDrop(t, store, game.ID, game.Modes[1].Activities[0].ID, 1)
	if _, err := store.db.ExecContext(ctx, `INSERT INTO goals (user_id, game_id, item_id) VALUES ($1, $2, 2)`, alexID, game.ID); err != nil {
		t.Fatal(err)
	}

	for itemID, want := range map[domain.ItemID]bool{1: true, 2: true, 3: false} {
		if got, err := store.DropLists().IsReferenced(ctx, itemID); err != nil || got != want {
			t.Errorf("item %d: %v, %v; want %v", itemID, got, err, want)
		}
	}
}

// Migration 0013 checks the item IDs, cascades goals with their game, and its Down removes both tables.
func TestMigration0013(t *testing.T) {
	store := migratedStore(t)
	game := createRaidGame(t, store)
	ctx := context.Background()
	activityID := game.Modes[1].Activities[0].ID
	if _, err := store.db.ExecContext(ctx, `INSERT INTO drop_items (activity_id, item_id, sort_order) VALUES ($1, 0, 0)`, activityID); err == nil {
		t.Fatal("drop item 0 stored; want the check to refuse it")
	}
	if _, err := store.db.ExecContext(ctx, `INSERT INTO goals (user_id, game_id, item_id) VALUES ($1, $2, 0)`, alexID, game.ID); err == nil {
		t.Fatal("goal item 0 stored; want the check to refuse it")
	}
	if _, err := store.db.ExecContext(ctx, `INSERT INTO goals (user_id, game_id, item_id) VALUES ($1, $2, 5)`, alexID, game.ID); err != nil {
		t.Fatal(err)
	}
	if err := store.Games().Delete(ctx, game.ID); err != nil {
		t.Fatal(err)
	}
	if rows := count(t, store, `SELECT count(*) FROM goals`); rows != 0 {
		t.Fatalf("%d goals after the game delete; want the cascade", rows)
	}

	migrateDownTo(t, store, 12)

	if tables := count(t, store, `SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('goals', 'drop_items')`); tables != 0 {
		t.Fatalf("%d tables after Down; want none", tables)
	}
	if err := store.Migrate(ctx, false); err != nil {
		t.Fatalf("migrate up again: %v", err)
	}
}
