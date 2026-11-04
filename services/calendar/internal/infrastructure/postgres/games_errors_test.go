package postgres

import (
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"openlobby/services/calendar/internal/application"
)

// gameWriteError maps the SQLSTATE codes of the game writes without a database (ADR 0010).
func TestGameWriteErrorMapsSQLStates(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want error
	}{
		{name: "malformed uuid is not found", err: &pgconn.PgError{Code: "22P02"}, want: application.ErrGameNotFound},
		{name: "wrapped malformed uuid is not found", err: fmt.Errorf("exec: %w", &pgconn.PgError{Code: "22P02"}), want: application.ErrGameNotFound},
		{name: "duplicate name is taken", err: &pgconn.PgError{Code: "23505"}, want: application.ErrGameTaken},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := gameWriteError(tc.err); !errors.Is(got, tc.want) {
				t.Fatalf("gameWriteError(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}
