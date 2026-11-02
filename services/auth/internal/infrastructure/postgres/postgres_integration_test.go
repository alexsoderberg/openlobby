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
	"time"

	"openlobby/services/auth/internal/application"
	"openlobby/services/auth/internal/domain"
)

// testStore gives each test its own schema on the database of TEST_DATABASE_URL. The schema gets the same default
// privileges as infra/postgres/init, so the migrations run with the grants that production has.
//
// The test cluster must be throwaway: the setup creates the NOLOGIN role `auth` when it is missing, which the
// migration's REVOKE needs (ADR 0012, amendment 2026-11-02 item 4). Point TEST_DATABASE_URL only at the CI service
// container or the development postgres container, never at a cluster with production data.
//
// Without TEST_DATABASE_URL the test fails instead of skipping, so that CI cannot show green without a database
// run (ADR 0012, amendment 2026-11-02 item 3).
func testStore(t *testing.T) *Store {
	t.Helper()
	base := os.Getenv("TEST_DATABASE_URL")
	if base == "" {
		t.Fatal("TEST_DATABASE_URL is not set: start the database with docker compose up postgres, ADR 0012")
	}
	schema := randomSchemaName(t)
	admin, err := sql.Open("pgx", base)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := admin.Close(); err != nil {
			t.Errorf("close admin connection: %v", err)
		}
	})
	setup := []string{
		`DO $$ BEGIN CREATE ROLE auth NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
		`CREATE SCHEMA "` + schema + `"`,
		`GRANT USAGE ON SCHEMA "` + schema + `" TO auth`,
		`ALTER DEFAULT PRIVILEGES IN SCHEMA "` + schema + `" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auth`,
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

	parsed, err := url.Parse(base)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	query.Set("search_path", schema)
	parsed.RawQuery = query.Encode()
	store, err := Open(parsed.String(), 5)
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

	// Positive control: the default privilege applies to users, so the next checks test the revoke, not a missing grant.
	var canWriteUsers bool
	if err := store.db.QueryRowContext(ctx, `SELECT has_table_privilege('auth', 'users', 'INSERT')`).Scan(&canWriteUsers); err != nil {
		t.Fatal(err)
	}
	if !canWriteUsers {
		t.Fatal("runtime role has no DML on users: the default privileges were not applied")
	}
	for _, privilege := range []string{"INSERT", "UPDATE", "DELETE"} {
		var allowed bool
		err := store.db.QueryRowContext(ctx,
			`SELECT has_table_privilege('auth', current_schema() || '.goose_db_version', $1)`, privilege,
		).Scan(&allowed)
		if err != nil {
			t.Fatal(err)
		}
		if allowed {
			t.Fatalf("runtime role has %s on goose_db_version", privilege)
		}
	}
}

func TestUpsertCreatesUserThenUpdatesDisplayName(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	identity := application.ExternalIdentity{Provider: "discord", SubjectID: "111", DisplayName: "Alex"}

	first, err := store.Users().Upsert(ctx, identity)
	if err != nil {
		t.Fatal(err)
	}
	identity.DisplayName = "Alex Renamed"
	second, err := store.Users().Upsert(ctx, identity)
	if err != nil {
		t.Fatal(err)
	}
	if second.ID != first.ID || second.DisplayName != "Alex Renamed" {
		t.Fatalf("second upsert %+v, first %+v", second, first)
	}
}

func TestLoginAttemptConsumedOnlyOnceAndNotWhenExpired(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	now := time.Now().UTC()
	live, expired := []byte("live-state"), []byte("expired-state")

	if err := store.Attempts().Insert(ctx, live, "verifier", "/groups/1", now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if err := store.Attempts().Insert(ctx, expired, "verifier", "/", now.Add(-time.Second)); err != nil {
		t.Fatal(err)
	}
	attempt, err := store.Attempts().Consume(ctx, live, now)
	if err != nil || attempt.CodeVerifier != "verifier" || attempt.ReturnTo != "/groups/1" {
		t.Fatalf("first consume: %+v, %v", attempt, err)
	}
	if _, err := store.Attempts().Consume(ctx, live, now); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("second consume: err = %v, want ErrNotFound", err)
	}
	if _, err := store.Attempts().Consume(ctx, expired, now); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expired consume: err = %v, want ErrNotFound", err)
	}
	if err := store.Attempts().DeleteExpired(ctx, now); err != nil {
		t.Fatal(err)
	}
}

func TestSessionsInsertFindDeleteAndExpiry(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	user, err := store.Users().Upsert(ctx, application.ExternalIdentity{Provider: "discord", SubjectID: "1", DisplayName: "A"})
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	live, old := []byte("live-hash"), []byte("old-hash")

	if err := store.Sessions().Insert(ctx, live, user.ID, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := store.Sessions().Insert(ctx, old, user.ID, now.Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}
	session, err := store.Sessions().Find(ctx, live)
	if err != nil || session.UserID != user.ID {
		t.Fatalf("find: %+v, %v", session, err)
	}
	if err := store.Sessions().DeleteExpired(ctx, now); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Sessions().Find(ctx, old); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expired session after cleanup: err = %v", err)
	}
	if err := store.Sessions().Delete(ctx, live); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Sessions().Find(ctx, live); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("deleted session: err = %v", err)
	}
}

func TestFindByIDsReturnsEachKnownUserOnce(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	user, err := store.Users().Upsert(ctx, application.ExternalIdentity{Provider: "discord", SubjectID: "1", DisplayName: "A"})
	if err != nil {
		t.Fatal(err)
	}
	users, err := store.Users().FindByIDs(ctx, []string{user.ID, user.ID, "00000000-0000-4000-8000-000000000000"})
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 1 || users[0].ID != user.ID {
		t.Fatalf("users = %+v", users)
	}
}

func TestUnreachableDatabaseIsUnavailable(t *testing.T) {
	store, err := Open("postgres://nobody:nothing@127.0.0.1:1/none?sslmode=disable&connect_timeout=1", 1)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := store.Close(); err != nil {
			t.Errorf("close store: %v", err)
		}
	})
	if err := store.Ping(context.Background()); !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("ping err = %v, want ErrUnavailable", err)
	}
}
