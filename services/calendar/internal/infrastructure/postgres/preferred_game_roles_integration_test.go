//go:build integration

package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"openlobby/services/calendar/internal/domain"
)

// deadlockDetected is the SQLSTATE of a deadlock. No write of ADR 0022 point 5 may end with it.
const deadlockDetected = "40P01"

// lockHoldTime is how long a test holds a transaction open, so the other write is sure to wait on its locks.
const lockHoldTime = 300 * time.Millisecond

// choiceFixture is the raid game (a hidden game-level Scout, a mode Ranked without roles, a mode Raid with Tank and
// Healer) and a duel game without modes with the role Fighter.
type choiceFixture struct {
	raid, duel                   domain.Game
	scout, tank, healer, fighter string
}

func seedChoiceGames(t *testing.T, store *Store, suffix string) choiceFixture {
	t.Helper()
	raidGame := raidGame()
	raidGame.Name += suffix
	raid, err := store.Games().Create(context.Background(), raidGame)
	if err != nil {
		t.Fatalf("create raid: %v", err)
	}
	duel, err := store.Games().Create(context.Background(), domain.Game{Name: "Duel" + suffix, GameRoles: []domain.GameRole{{Name: "Fighter", Slots: 2}}})
	if err != nil {
		t.Fatalf("create duel: %v", err)
	}
	return choiceFixture{raid: raid, duel: duel, scout: raid.GameRoles[0].ID, tank: raid.Modes[1].GameRoles[0].ID,
		healer: raid.Modes[1].GameRoles[1].ID, fighter: duel.GameRoles[0].ID}
}

func chosen(t *testing.T, store *Store, userID string) []string {
	t.Helper()
	ids, err := store.PreferredGameRoles().ChosenGameRoleIDs(context.Background(), userID)
	if err != nil {
		t.Fatal(err)
	}
	slices.Sort(ids)
	return ids
}

func sorted(ids ...string) []string {
	return slices.Sorted(slices.Values(ids))
}

func replaceChoices(t *testing.T, store *Store, userID string, ids ...string) {
	t.Helper()
	if err := store.PreferredGameRoles().Replace(context.Background(), userID, ids); err != nil {
		t.Fatalf("replace %v: %v", ids, err)
	}
}

// assertNoOrphanChoice checks that no choice refers to a game role that does not exist (ADR 0022 point 2).
func assertNoOrphanChoice(t *testing.T, store *Store) {
	t.Helper()
	var orphans int
	err := store.db.QueryRowContext(context.Background(), `SELECT count(*) FROM preferred_game_roles p
		WHERE NOT EXISTS (SELECT 1 FROM game_roles gr WHERE gr.id = p.game_role_id)`).Scan(&orphans)
	if err != nil || orphans != 0 {
		t.Fatalf("orphan choices %d (%v), want none", orphans, err)
	}
}

func isDeadlock(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == deadlockDetected
}

func TestPreferredGameRolesDownDropsTheTable(t *testing.T) {
	store := migratedStore(t)
	exists := func() bool {
		var name sql.NullString
		if err := store.db.QueryRowContext(context.Background(), `SELECT to_regclass('preferred_game_roles')::text`).Scan(&name); err != nil {
			t.Fatal(err)
		}
		return name.Valid
	}
	if !exists() {
		t.Fatal("migration 0008 did not create preferred_game_roles")
	}

	migrateDownTo(t, store, 7)

	if exists() {
		t.Fatal("down of 0008 left preferred_game_roles")
	}
}

func TestReplaceStoresEffectiveRolesAndRefusesTheRest(t *testing.T) {
	store := migratedStore(t)
	fixture := seedChoiceGames(t, store, "")
	replaceChoices(t, store, alexID, fixture.tank, fixture.fighter)
	replaceChoices(t, store, otherID, fixture.healer)

	for name, ids := range map[string][]string{
		"game-level role of a game with modes": {fixture.scout},
		"unknown ID":                           {fixture.tank, missingRoleID},
		"not a uuid":                           {fixture.tank, "tank"},
	} {
		if err := store.PreferredGameRoles().Replace(context.Background(), alexID, ids); !errors.Is(err, domain.ErrInvalidGameRole) {
			t.Fatalf("%s: error %v, want ErrInvalidGameRole", name, err)
		}
	}

	if got := chosen(t, store, alexID); !slices.Equal(got, sorted(fixture.tank, fixture.fighter)) {
		t.Fatalf("alex's choices %v after refusals, want tank and fighter", got)
	}
	replaceChoices(t, store, alexID)
	if got := chosen(t, store, alexID); len(got) != 0 || !slices.Equal(chosen(t, store, otherID), []string{fixture.healer}) {
		t.Fatalf("alex %v, other %v; want alex cleared and other kept", got, chosen(t, store, otherID))
	}
}

// Each admin write keeps the choices of kept role IDs and removes those of removed roles (ADR 0022 point 2).
func TestAdminWritesKeepOrRemoveChoices(t *testing.T) {
	tests := []struct {
		name  string
		write func(store *Store, fixture choiceFixture) error
		want  func(fixture choiceFixture) []string
	}{
		{name: "rename a role and save again", write: func(store *Store, f choiceFixture) error {
			game := f.raid
			game.Modes = slices.Clone(f.raid.Modes)
			game.Modes[1].GameRoles = []domain.GameRole{{ID: f.tank, Name: "Shield", Slots: 1}, f.raid.Modes[1].GameRoles[1]}
			_, err := store.Games().Replace(context.Background(), game)
			return err
		}, want: func(f choiceFixture) []string { return sorted(f.tank, f.healer, f.fighter) }},
		{name: "remove a role", write: func(store *Store, f choiceFixture) error {
			game := domain.Game{ID: f.raid.ID, Name: f.raid.Name, Modes: slices.Clone(f.raid.Modes)}
			game.Modes[1].GameRoles = []domain.GameRole{f.raid.Modes[1].GameRoles[1]}
			game.Modes[1].MaxPlayers = intPtr(f.raid.Modes[1].GameRoles[1].Slots) // the adapter stores the sum as given
			_, err := store.Games().Replace(context.Background(), game)
			return err
		}, want: func(f choiceFixture) []string { return sorted(f.healer, f.fighter) }},
		{name: "remove a mode with game roles nil", write: func(store *Store, f choiceFixture) error {
			_, err := store.Games().Replace(context.Background(), domain.Game{ID: f.raid.ID, Name: f.raid.Name, Modes: f.raid.Modes[:1]})
			return err
		}, want: func(f choiceFixture) []string { return []string{f.fighter} }},
		{name: "re-create the modes with kept IDs", write: func(store *Store, f choiceFixture) error {
			_, err := store.Games().Replace(context.Background(), domain.Game{ID: f.raid.ID, Name: f.raid.Name, Modes: f.raid.Modes})
			return err
		}, want: func(f choiceFixture) []string { return sorted(f.tank, f.healer, f.fighter) }},
		{name: "delete the game", write: func(store *Store, f choiceFixture) error {
			return store.Games().Delete(context.Background(), f.raid.ID)
		}, want: func(f choiceFixture) []string { return []string{f.fighter} }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := migratedStore(t)
			fixture := seedChoiceGames(t, store, "")
			replaceChoices(t, store, alexID, fixture.tank, fixture.healer, fixture.fighter)

			if err := tc.write(store, fixture); err != nil {
				t.Fatalf("admin write: %v", err)
			}

			if got, want := chosen(t, store, alexID), tc.want(fixture); !slices.Equal(got, want) {
				t.Fatalf("choices %v, want %v", got, want)
			}
			assertNoOrphanChoice(t, store)
		})
	}
}

// Two saves of the same person run one after the other, so both succeed and the last one wins (ADR 0022 point 5).
func TestConcurrentReplacesOfOnePersonBothSucceed(t *testing.T) {
	store := migratedStore(t)
	fixture := seedChoiceGames(t, store, "")
	first, second := []string{fixture.tank}, sorted(fixture.healer, fixture.fighter)

	for round := range 20 {
		var wg sync.WaitGroup
		errs := make([]error, 2)
		for i, ids := range [][]string{first, second} {
			wg.Go(func() { errs[i] = store.PreferredGameRoles().Replace(context.Background(), alexID, ids) })
		}
		wg.Wait()

		if errs[0] != nil || errs[1] != nil {
			t.Fatalf("round %d: errors %v", round, errs)
		}
		if got := chosen(t, store, alexID); !slices.Equal(got, first) && !slices.Equal(got, second) {
			t.Fatalf("round %d: choices %v, want one of the two inputs", round, got)
		}
	}
}

// A save racing an admin write that removes the chosen role ends with invalid_game_role or with the choice removed.
// A save racing an admin write that keeps the role may also get invalid_game_role (ADR 0022 PR2 tests).
func TestReplaceRacingAnAdminWriteLeavesNoOrphan(t *testing.T) {
	store := migratedStore(t)
	for round := range 10 {
		for _, keep := range []bool{false, true} {
			fixture := seedChoiceGames(t, store, fmt.Sprintf(" %d %t", round, keep))
			game := domain.Game{ID: fixture.raid.ID, Name: fixture.raid.Name, Modes: slices.Clone(fixture.raid.Modes)}
			if !keep {
				game.Modes[1].GameRoles = game.Modes[1].GameRoles[1:]
				game.Modes[1].MaxPlayers = intPtr(game.Modes[1].GameRoles[0].Slots)
			}
			var wg sync.WaitGroup
			var putErr, adminErr error
			wg.Go(func() {
				putErr = store.PreferredGameRoles().Replace(context.Background(), alexID, []string{fixture.tank})
			})
			wg.Go(func() { _, adminErr = store.Games().Replace(context.Background(), game) })
			wg.Wait()

			if adminErr != nil || (putErr != nil && !errors.Is(putErr, domain.ErrInvalidGameRole)) {
				t.Fatalf("round %d keep %t: put %v, admin %v", round, keep, putErr, adminErr)
			}
			if isChosen := slices.Contains(chosen(t, store, alexID), fixture.tank); isChosen != (keep && putErr == nil) {
				t.Fatalf("round %d keep %t: tank chosen %t after put %v", round, keep, isChosen, putErr)
			}
			assertNoOrphanChoice(t, store)
		}
	}
}

// The real save is parked between its game locks and its role locks, and an admin save of a game it named, keeping the
// roles, starts then. Both finish, with no deadlock, and the kept choices stay (ADR 0022 point 5, lock order).
func TestAdminWriteWhileASaveHoldsItsGameLocks(t *testing.T) {
	store := migratedStore(t)
	f := seedChoiceGames(t, store, "")
	ids := []string{f.fighter, f.tank}
	holder := holdLock(t, store, `SELECT 1 FROM game_roles WHERE id = $1 FOR UPDATE`, f.tank)

	errs := parked(t, holder.Rollback, func() error {
		return store.PreferredGameRoles().Replace(context.Background(), alexID, ids)
	}, func() error {
		_, err := store.Games().Replace(context.Background(), keptRaid(f))
		return err
	})

	if errs[0] != nil || errs[1] != nil {
		t.Fatalf("save %v, admin write %v; want both to succeed", errs[0], errs[1])
	}
	if got := chosen(t, store, alexID); !slices.Equal(got, sorted(ids...)) {
		t.Fatalf("choices %v, want %v", got, sorted(ids...))
	}
	assertNoOrphanChoice(t, store)
}

// The admin write holds its game lock and has re-inserted the kept roles when the real save starts. The save succeeds,
// or gets invalid_game_role and changes nothing.
func TestSaveWhileAnAdminWriteHoldsItsGameLock(t *testing.T) {
	store := migratedStore(t)
	f := seedChoiceGames(t, store, "")
	ids := []string{f.fighter, f.tank}
	holder := holdLock(t, store, lockGameSQL, f.raid.ID)
	if err := writeTree(context.Background(), holder, keptRaid(f)); err != nil {
		t.Fatalf("admin write: %v", errors.Join(err, holder.Rollback()))
	}

	errs := parked(t, holder.Commit, func() error {
		return store.PreferredGameRoles().Replace(context.Background(), alexID, ids)
	})

	want := sorted(ids...)
	if errors.Is(errs[0], domain.ErrInvalidGameRole) {
		want = nil
	} else if errs[0] != nil {
		t.Fatalf("save: %v", errs[0])
	}
	if got := chosen(t, store, alexID); !slices.Equal(got, want) {
		t.Fatalf("choices %v after save %v, want %v", got, errs[0], want)
	}
	assertNoOrphanChoice(t, store)
}

// otherPeopleWithChoices is enough rows that the cleanup reads the whole table in physical order, while the save, with
// bitmap scans off, reads one person's choices by the primary key in key order. On a bigger table the planner picks that
// plan pair by itself, and it deadlocked when each statement locked in its scan order (ADR 0022 point 5).
const otherPeopleWithChoices = 5000

// Two choices are stored with the higher key first, so a sequential scan meets them in the reverse of key order. The
// admin write's cleanup waits on the higher row, then the save deletes the person's rows. Both lock in key order, so
// neither deadlocks (ADR 0022 point 5).
func TestCleanupAndSaveLockChoicesInTheSameOrder(t *testing.T) {
	store := migratedStore(t)
	f := seedChoiceGames(t, store, "")
	lower, higher := min(f.tank, f.healer), max(f.tank, f.healer)
	if err := execAll(context.Background(), store,
		`INSERT INTO preferred_game_roles (user_id, game_role_id) VALUES ('`+alexID+`', '`+higher+`')`,
		`INSERT INTO preferred_game_roles (user_id, game_role_id) VALUES ('`+alexID+`', '`+lower+`')`,
		fmt.Sprintf(`INSERT INTO preferred_game_roles (user_id, game_role_id) SELECT gen_random_uuid(), '%s' FROM generate_series(1, %d)`, f.fighter, otherPeopleWithChoices),
		`ANALYZE preferred_game_roles`,
	); err != nil {
		t.Fatal(err)
	}
	holder := holdLock(t, store, `SELECT 1 FROM preferred_game_roles WHERE user_id = $1 AND game_role_id = $2 FOR UPDATE`, alexID, higher)

	saver := sameSchemaStore(t, store, "enable_bitmapscan", "off")

	errs := parked(t, holder.Rollback, func() error {
		_, err := store.Games().Replace(context.Background(), domain.Game{ID: f.raid.ID, Name: f.raid.Name, Modes: f.raid.Modes[:1]})
		return err
	}, func() error {
		return saver.PreferredGameRoles().Replace(context.Background(), alexID, []string{f.fighter})
	})

	if errs[0] != nil || errs[1] != nil {
		t.Fatalf("admin write %v, save %v; want both to succeed", errs[0], errs[1])
	}
	if got := chosen(t, store, alexID); !slices.Equal(got, []string{f.fighter}) {
		t.Fatalf("choices %v, want the fighter only", got)
	}
	assertNoOrphanChoice(t, store)
}

// sameSchemaStore opens a second store on the schema of store, with one more setting for its sessions.
func sameSchemaStore(t *testing.T, store *Store, setting, value string) *Store {
	t.Helper()
	var schema string
	if err := store.db.QueryRowContext(context.Background(), `SELECT current_schema()`).Scan(&schema); err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(requireTestDatabaseURL(t))
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	query.Set(setting, value)
	parsed.RawQuery = query.Encode()
	return openStore(t, parsed.String(), schema)
}

func keptRaid(f choiceFixture) domain.Game {
	return domain.Game{ID: f.raid.ID, Name: f.raid.Name, Modes: f.raid.Modes}
}

// holdLock begins a transaction that holds the lock of the query. The caller ends it.
func holdLock(t *testing.T, store *Store, query string, args ...any) *sql.Tx {
	t.Helper()
	tx, err := store.db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.ExecContext(context.Background(), query, args...); err != nil {
		t.Fatalf("hold: %v", errors.Join(err, tx.Rollback()))
	}
	return tx
}

// parked starts the writes in order, lockHoldTime apart, so each one is waiting before the next starts. It then ends
// the holder's transaction and returns the writes' errors. A deadlock in any write fails the test.
func parked(t *testing.T, end func() error, writes ...func() error) []error {
	t.Helper()
	errs := make([]error, len(writes))
	var wg sync.WaitGroup
	for i, write := range writes {
		wg.Go(func() { errs[i] = write() })
		time.Sleep(lockHoldTime)
	}
	if err := end(); err != nil {
		t.Fatalf("end the holder: %v", err)
	}
	wg.Wait()
	for i, err := range errs {
		if isDeadlock(err) {
			t.Fatalf("write %d: deadlock: %v", i, err)
		}
	}
	return errs
}

// The SQL rule and the domain rule name the same effective game roles on the same games (ADR 0022 point 2).
func TestEffectiveGameRoleRuleParity(t *testing.T) {
	store := migratedStore(t)
	fixture := seedChoiceGames(t, store, "")
	ctx := context.Background()

	var fromSQL []string
	err := eachRow(ctx, store.db, func(rows *sql.Rows) error {
		var id string
		err := rows.Scan(&id)
		fromSQL = append(fromSQL, id)
		return err
	}, `SELECT gr.id FROM game_roles gr WHERE `+effectiveGameRoleSQL)
	if err != nil {
		t.Fatal(err)
	}
	games, err := store.Games().List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var fromDomain []string
	for _, game := range games {
		for _, role := range game.EffectiveGameRoles() {
			fromDomain = append(fromDomain, role.ID)
		}
	}

	slices.Sort(fromSQL)
	slices.Sort(fromDomain)
	if !slices.Equal(fromSQL, fromDomain) || !slices.Equal(fromSQL, sorted(fixture.tank, fixture.healer, fixture.fighter)) {
		t.Fatalf("SQL %v, domain %v; want the tank, the healer and the fighter, not the hidden scout", fromSQL, fromDomain)
	}
}
