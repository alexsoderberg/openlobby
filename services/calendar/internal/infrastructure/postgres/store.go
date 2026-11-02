// Package postgres implements the calendar repositories on PostgreSQL (ADR 0012). database/sql and pgx types stay here.
package postgres

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"net"
	"slices"

	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"openlobby/services/calendar/internal/domain"
	"openlobby/services/calendar/migrations"
)

// Store is the PostgreSQL adapter. It implements the repositories of the application.
type Store struct {
	db *sql.DB
}

// Open prepares a connection pool. It does not connect; Ping checks the database.
func Open(databaseURL string, maxConnections int) (*Store, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	db.SetMaxOpenConns(maxConnections)
	return &Store{db: db}, nil
}

// Groups returns the group repository.
func (s *Store) Groups() groupRepo { return groupRepo{s} }

// Close releases the pool.
func (s *Store) Close() error {
	return s.db.Close()
}

// Ping checks that the database answers. Used by /readyz (ADR 0008).
func (s *Store) Ping(ctx context.Context) error {
	return translate(s.db.PingContext(ctx))
}

// Migrate runs all pending migrations, or rolls back one step when down is true (ADR 0012).
func (s *Store) Migrate(ctx context.Context, down bool) error {
	provider, err := goose.NewProvider(goose.DialectPostgres, s.db, migrations.FS)
	if err != nil {
		return fmt.Errorf("create migration provider: %w", err)
	}
	if down {
		_, err = provider.Down(ctx)
	} else {
		_, err = provider.Up(ctx)
	}
	return err
}

// unavailableClasses are the SQLSTATE classes that mean the database did not answer: connection exception (08),
// insufficient resources (53) and operator intervention (57) (ADR 0001).
var unavailableClasses = []string{"08", "53", "57"}

// translate maps database errors to domain errors. A failure to reach the database is domain.ErrUnavailable (503).
// Any other error is a SQL error or a bug and stays as it is (500).
func translate(err error) error {
	switch {
	case err == nil:
		return nil
	case isConnectionFailure(err):
		return fmt.Errorf("%w: %w", domain.ErrUnavailable, err)
	default:
		return err
	}
}

func isConnectionFailure(err error) bool {
	var connectErr *pgconn.ConnectError
	var netErr net.Error
	var pgErr *pgconn.PgError
	switch {
	case errors.Is(err, driver.ErrBadConn), errors.As(err, &connectErr), errors.As(err, &netErr):
		return true
	case errors.As(err, &pgErr) && len(pgErr.Code) >= 2:
		return slices.Contains(unavailableClasses, pgErr.Code[:2])
	}
	return false
}
