//go:build integration

package postgres

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/url"
	"os"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

const (
	fridayID = "11111111-1111-4111-8111-111111111111"
	sundayID = "22222222-2222-4222-8222-222222222222"
	emptyID  = "33333333-3333-4333-8333-333333333333"
	alexID   = "5f0c2e1a-9b7d-4c1e-8a3f-1d2e3f4a5b6c"
	otherID  = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
	nobodyID = "9e8d7c6b-5a49-4837-8271-605f4e3d2c1b"

	// testPoolSize is the connection pool of a test store, as in production (ADR 0008).
	testPoolSize = 5
)

// testStore gives each test its own schema on the database of TEST_DATABASE_URL. The schema gets the same default
// privileges as infra/postgres/init, so the migrations run with the grants that production has.
//
// The test cluster must be throwaway: the setup creates the NOLOGIN role `calendar` when it is missing, which the
// migration's REVOKE needs (ADR 0012). Point TEST_DATABASE_URL only at the CI service container or the development
// postgres container, never at a cluster with production data.
func testStore(t *testing.T) *Store {
	t.Helper()
	base := requireTestDatabaseURL(t)
	schema := randomSchemaName(t)
	createSchema(t, openAdmin(t, base), schema)
	return openStore(t, base, schema)
}

// requireTestDatabaseURL fails, instead of skipping, without TEST_DATABASE_URL, so that CI cannot show green
// without a database run (ADR 0012).
func requireTestDatabaseURL(t *testing.T) string {
	t.Helper()
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Fatal("TEST_DATABASE_URL is not set: start the database with docker compose up postgres, ADR 0012")
	}
	return base
}

func openAdmin(t *testing.T, base string) *sql.DB {
	t.Helper()
	admin, err := sql.Open("pgx", base)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := admin.Close(); err != nil {
			t.Errorf("close admin connection: %v", err)
		}
	})
	return admin
}

// createSchema creates the role if it is missing, the schema with its default privileges, and drops the schema
// when the test ends.
func createSchema(t *testing.T, admin *sql.DB, schema string) {
	t.Helper()
	setup := []string{
		`DO $$ BEGIN CREATE ROLE calendar NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`CREATE SCHEMA "` + schema + `"`,
		`GRANT USAGE ON SCHEMA "` + schema + `" TO calendar`,
		`ALTER DEFAULT PRIVILEGES IN SCHEMA "` + schema + `" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO calendar`,
	}
	for _, statement := range setup {
		if _, err := admin.Exec(statement); err != nil {
			t.Fatalf("setup %q: %v", statement, err)
		}
	}
	t.Cleanup(func() {
		if _, err := admin.Exec(`DROP SCHEMA "` + schema + `" CASCADE`); err != nil {
			t.Errorf("drop schema: %v", err)
		}
	})
}

// openStore opens a store whose search_path is the test schema.
func openStore(t *testing.T, base, schema string) *Store {
	t.Helper()
	parsed, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	store, err := Open(parsed.String(), testPoolSize)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := store.Close(); err != nil {
			t.Errorf("close store: %v", err)
		}
	})
	return store
}

func randomSchemaName(t *testing.T) string {
	t.Helper()
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		t.Fatal(err)
	}
	return "test_" + hex.EncodeToString(buf)
}

func migratedStore(t *testing.T) *Store {
	t.Helper()
	store := testStore(t)
	if err := store.Migrate(context.Background(), false); err != nil {
		t.Fatalf("migrate up: %v", err)
	}
	return store
}

func TestMigrationsUpDownUpAndRuntimeRoleCannotChangeHistory(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	for _, step := range []struct {
		name string
		down bool
	}{{"up", false}, {"down", true}, {"up again", false}} {
		if err := store.Migrate(ctx, step.down); err != nil {
			t.Fatalf("migrate %s: %v", step.name, err)
		}
	}
	assertRuntimeRoleCannotWriteHistory(t, store)
}

// assertRuntimeRoleCannotWriteHistory checks the REVOKE of migration 0001 (ADR 0012, operations base item 2).
func assertRuntimeRoleCannotWriteHistory(t *testing.T, store *Store) {
	t.Helper()
	ctx := context.Background()

	// Positive control: the default privilege applies to groups, so the checks below test the revoke, not a missing grant.
	var canWriteGroups bool
	if err := store.db.QueryRowContext(ctx, `SELECT has_table_privilege('calendar', 'groups', 'INSERT')`).Scan(&canWriteGroups); err != nil {
		t.Fatal(err)
	}
	if !canWriteGroups {
		t.Fatal("runtime role has no DML on groups: the default privileges were not applied")
	}
	for _, privilege := range []string{"INSERT", "UPDATE", "DELETE"} {
		var allowed bool
		err := store.db.QueryRowContext(ctx,
			`SELECT has_table_privilege('calendar', current_schema() || '.goose_db_version', $1)`, privilege,
		).Scan(&allowed)
		if err != nil {
			t.Fatal(err)
		}
		if allowed {
			t.Fatalf("runtime role has %s on goose_db_version", privilege)
		}
	}
}

// seedGroups gives Alex the groups Friday and Sunday, and Other the group Sunday. The group Empty has no member.
func seedGroups(t *testing.T, store *Store) {
	t.Helper()
	statements := []struct {
		sql  string
		args []any
	}{
		{`INSERT INTO groups (id, name) VALUES ($1, 'Friday'), ($2, 'Sunday'), ($3, 'Empty')`, []any{fridayID, sundayID, emptyID}},
		{`INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES
			($1, $2, 'admin', now()), ($3, $2, 'member', now()), ($3, $4, 'member', now())`,
			[]any{fridayID, alexID, sundayID, otherID}},
	}
	for _, statement := range statements {
		if _, err := store.db.ExecContext(context.Background(), statement.sql, statement.args...); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
}

func namesOf(groups []domain.Group) map[string]string {
	names := make(map[string]string, len(groups))
	for _, group := range groups {
		names[group.ID] = group.Name
	}
	return names
}

func TestListForUserReturnsOnlyGroupsWhereUserIsMember(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()

	tests := []struct {
		name   string
		userID string
		want   map[string]string
	}{
		{name: "member of two groups", userID: alexID, want: map[string]string{fridayID: "Friday", sundayID: "Sunday"}},
		{name: "member of one group sees no other user's group", userID: otherID, want: map[string]string{sundayID: "Sunday"}},
		{name: "user in no group gets none", userID: nobodyID, want: map[string]string{}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			groups, err := store.Groups().ListForUser(ctx, tc.userID)
			if err != nil {
				t.Fatal(err)
			}
			got := namesOf(groups)
			if len(got) != len(tc.want) {
				t.Fatalf("groups %v, want %v", got, tc.want)
			}
			for id, name := range tc.want {
				if got[id] != name {
					t.Fatalf("groups %v, want %v", got, tc.want)
				}
			}
		})
	}
}

func TestUnreachableDatabaseIsUnavailable(t *testing.T) {
	store, err := Open("postgres://nobody:nothing@127.0.0.1:1/none?sslmode=disable&connect_timeout=1", 1)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := store.Close(); err != nil {
			t.Errorf("close store: %v", err)
		}
	}()

	if _, err := store.Groups().ListForUser(context.Background(), alexID); !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("list error %v, want ErrUnavailable", err)
	}
	if err := store.Ping(context.Background()); !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("ping error %v, want ErrUnavailable", err)
	}
}
