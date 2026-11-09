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
		{name: "duplicate game name is taken", err: &pgconn.PgError{Code: "23505", ConstraintName: "games_name_lower_key"}, want: application.ErrGameTaken},
		{name: "duplicate mode name", err: &pgconn.PgError{Code: "23505", ConstraintName: "game_modes_game_name_key"}, want: application.ErrModeTaken},
		{name: "duplicate game role name on the game", err: &pgconn.PgError{Code: "23505", ConstraintName: "game_roles_game_name_key"}, want: application.ErrGameRoleTaken},
		{name: "duplicate game role name on a mode", err: &pgconn.PgError{Code: "23505", ConstraintName: "game_roles_mode_name_key"}, want: application.ErrGameRoleTaken},
		{name: "duplicate activity name", err: &pgconn.PgError{Code: "23505", ConstraintName: "activities_mode_name_key"}, want: application.ErrActivityTaken},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := gameWriteError(tc.err); !errors.Is(got, tc.want) {
				t.Fatalf("gameWriteError(%v) = %v, want %v", tc.err, got, tc.want)
			}
		})
	}
}

// A unique violation of another index, or one without a known name, is not a "taken" answer.
func TestGameWriteErrorLeavesUnknownUniqueViolationsAlone(t *testing.T) {
	err := &pgconn.PgError{Code: "23505", ConstraintName: "games_pkey"}

	if got := gameWriteError(err); !errors.Is(got, err) || errors.Is(got, application.ErrGameTaken) {
		t.Fatalf("gameWriteError(%v) = %v, want the error itself", err, got)
	}
}
