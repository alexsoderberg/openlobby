// Package postgres implements the auth repositories and the transaction port on PostgreSQL (ADR 0012).
// database/sql and pgx types stay in this package.
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

	"openlobby/services/auth/internal/domain"
	"openlobby/services/auth/migrations"
)

// Store is the PostgreSQL adapter. It implements the repositories and the transactor of the application.
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

// Users, Sessions and Attempts are the repositories that the application ports use.
func (s *Store) Users() userRepo       { return userRepo{s} }
func (s *Store) Sessions() sessionRepo { return sessionRepo{s} }
func (s *Store) Attempts() attemptRepo { return attemptRepo{s} }

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

type txKey struct{}

// InTx runs fn in one transaction. Repositories called with the context of fn use that transaction (ADR 0005).
func (s *Store) InTx(ctx context.Context, fn func(context.Context) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return translate(err)
	}
	if err := fn(context.WithValue(ctx, txKey{}, tx)); err != nil {
		return errors.Join(err, translate(tx.Rollback()))
	}
	return translate(tx.Commit())
}

// querier is what the repositories need. It is a transaction when one is in the context.
type querier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func (s *Store) conn(ctx context.Context) querier {
	if tx, ok := ctx.Value(txKey{}).(*sql.Tx); ok {
		return tx
	}
	return s.db
}

// unavailableClasses are the SQLSTATE classes that mean the database did not answer: connection exception (08),
// insufficient resources (53) and operator intervention (57) (ADR 0001, amendment 2026-11-02 item 8).
var unavailableClasses = []string{"08", "53", "57"}

// translate maps database errors to domain errors. A missing row is domain.ErrNotFound. A failure to reach the
// database is domain.ErrUnavailable (503). Any other error is a SQL error or a bug and stays as it is (500).
func translate(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, sql.ErrNoRows):
		return domain.ErrNotFound
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
