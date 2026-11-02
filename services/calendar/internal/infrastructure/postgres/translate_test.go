package postgres

import (
	"context"
	"database/sql/driver"
	"errors"
	"net"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"openlobby/services/calendar/internal/domain"
)

// TestTranslate checks the mapping of ADR 0001 (503 only when the database did not answer) without a database.
func TestTranslate(t *testing.T) {
	tests := []struct {
		name            string
		err             error
		wantUnavailable bool
	}{
		{name: "SQL error is not unavailable", err: &pgconn.PgError{Code: "42601"}},
		{name: "unique violation is not unavailable", err: &pgconn.PgError{Code: "23505"}},
		{name: "connection exception is unavailable", err: &pgconn.PgError{Code: "08006"}, wantUnavailable: true},
		{name: "insufficient resources is unavailable", err: &pgconn.PgError{Code: "53300"}, wantUnavailable: true},
		{name: "operator intervention is unavailable", err: &pgconn.PgError{Code: "57P01"}, wantUnavailable: true},
		{name: "connect error is unavailable", err: &pgconn.ConnectError{}, wantUnavailable: true},
		{name: "network error is unavailable", err: &net.OpError{Op: "dial", Err: errors.New("refused")}, wantUnavailable: true},
		{name: "bad connection is unavailable", err: driver.ErrBadConn, wantUnavailable: true},
		{name: "wrapped network error is unavailable", err: errors.Join(errors.New("ctx"), &net.OpError{Op: "read"}), wantUnavailable: true},
		{name: "deadline exceeded is unavailable", err: context.DeadlineExceeded, wantUnavailable: true},
		{name: "unknown error is not unavailable", err: errors.New("bug")},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := errors.Is(translate(tc.err), domain.ErrUnavailable)
			if got != tc.wantUnavailable {
				t.Fatalf("unavailable = %v, want %v (err %v)", got, tc.wantUnavailable, tc.err)
			}
		})
	}
}

func TestTranslateNilIsNil(t *testing.T) {
	if translate(nil) != nil {
		t.Fatal("translate(nil) is not nil")
	}
}
