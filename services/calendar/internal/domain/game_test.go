package domain_test

import (
	"errors"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

// The name rule of ADR 0010 and ADR 0004 rule 1: trimmed, 1 to 50 code points, and not the reserved name "Other".
func TestNewGameAcceptsValidNamesAndTrims(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "one character", raw: "a", want: "a"},
		{name: "fifty characters", raw: strings.Repeat("a", 50), want: strings.Repeat("a", 50)},
		{name: "spaces around are trimmed", raw: "  Chess  ", want: "Chess"},
		{name: "tab and newline are trimmed", raw: "\tChess\n", want: "Chess"},
		{name: "fifty code points of two bytes each", raw: strings.Repeat("å", 50), want: strings.Repeat("å", 50)},
		{name: "Other inside a longer name is allowed", raw: "Other Chess", want: "Other Chess"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			game, err := domain.NewGame("", tc.raw, nil, nil, nil, nil)

			if err != nil || game.Name != tc.want {
				t.Fatalf("name %q, error %v; want %q", game.Name, err, tc.want)
			}
		})
	}
}

func TestNewGameRejectsInvalidNames(t *testing.T) {
	tests := []struct {
		name string
		raw  string
	}{
		{name: "empty", raw: ""},
		{name: "only spaces", raw: "   "},
		{name: "only tabs and newlines", raw: "\t\n"},
		{name: "fifty-one characters", raw: strings.Repeat("a", 51)},
		{name: "fifty-one code points of two bytes each", raw: strings.Repeat("å", 51)},
		{name: "Other", raw: "Other"},
		{name: "other in lower case", raw: "other"},
		{name: "Other with surrounding spaces", raw: "  OTHER "},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := domain.NewGame("", tc.raw, nil, nil, nil, nil)

			if !errors.Is(err, domain.ErrInvalidGame) {
				t.Fatalf("error %v, want ErrInvalidGame", err)
			}
		})
	}
}

// The default max is optional and must be at least 1 when given (ADR 0010, REQ-0009).
func TestNewGameDefaultMaxPlayers(t *testing.T) {
	intPtr := func(value int) *int { return &value }
	tests := []struct {
		name    string
		max     *int
		wantErr error
	}{
		{name: "omitted means unlimited", max: nil},
		{name: "one is the smallest allowed", max: intPtr(1)},
		{name: "largest allowed", max: intPtr(2147483647)},
		{name: "one above the largest is rejected", max: intPtr(2147483648), wantErr: domain.ErrInvalidCapacity},
		{name: "zero is rejected", max: intPtr(0), wantErr: domain.ErrInvalidCapacity},
		{name: "negative is rejected", max: intPtr(-3), wantErr: domain.ErrInvalidCapacity},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			game, err := domain.NewGame("", "Chess", tc.max, nil, nil, nil)

			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("error %v, want %v", err, tc.wantErr)
			}
			if tc.wantErr == nil && !equalMax(game.DefaultMaxPlayers, tc.max) {
				t.Fatalf("default max %v, want %v", game.DefaultMaxPlayers, tc.max)
			}
		})
	}
}

// A bad name is reported before a bad default max (the rule order of ADR 0010).
func TestNewGameReportsNameBeforeCapacity(t *testing.T) {
	zero := 0

	_, err := domain.NewGame("", "", &zero, nil, nil, nil)

	if !errors.Is(err, domain.ErrInvalidGame) {
		t.Fatalf("error %v, want ErrInvalidGame", err)
	}
}

// The ID is kept as given, so a replaced game keeps its identity (ADR 0010).
func TestNewGameKeepsTheID(t *testing.T) {
	game, err := domain.NewGame("ce3ff9c1-dabb-4270-b5e0-7b34de37410b", "Chess", nil, nil, nil, nil)

	if err != nil || game.ID != "ce3ff9c1-dabb-4270-b5e0-7b34de37410b" {
		t.Fatalf("game %+v, error %v; want the ID kept", game, err)
	}
}

func equalMax(a, b *int) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

// The genre rule of ADR 0016: nil or one of Genres() exactly as written.
func TestNewGameGenre(t *testing.T) {
	type genreCase struct {
		name    string
		genre   string
		wantErr error
	}
	tests := []genreCase{
		{name: "unknown value", genre: "puzzle", wantErr: domain.ErrInvalidGenre},
		{name: "capital letter", genre: "Shooter", wantErr: domain.ErrInvalidGenre},
		{name: "empty string", genre: "", wantErr: domain.ErrInvalidGenre},
	}
	for _, genre := range domain.Genres() {
		tests = append(tests, genreCase{name: string(genre), genre: string(genre)})
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			genre := domain.Genre(tc.genre)

			game, err := domain.NewGame("", "Chess", nil, &genre, nil, nil)

			if !errors.Is(err, tc.wantErr) || (err == nil && (game.Genre == nil || *game.Genre != genre)) {
				t.Fatalf("game %+v, error %v; want error %v", game, err, tc.wantErr)
			}
		})
	}
}

func TestNewGameWithoutGenreHasNone(t *testing.T) {
	game, err := domain.NewGame("", "Chess", nil, nil, nil, nil)

	if err != nil || game.Genre != nil {
		t.Fatalf("game %+v, error %v; want no genre", game, err)
	}
}

// Name and capacity are reported before the genre, the order of the contract.
func TestNewGameReportsGenreAfterNameAndCapacity(t *testing.T) {
	bad, zero := domain.Genre("puzzle"), 0

	if _, err := domain.NewGame("", "", &zero, &bad, nil, nil); !errors.Is(err, domain.ErrInvalidGame) {
		t.Fatalf("error %v, want ErrInvalidGame", err)
	}
	if _, err := domain.NewGame("", "Chess", &zero, &bad, nil, nil); !errors.Is(err, domain.ErrInvalidCapacity) {
		t.Fatalf("error %v, want ErrInvalidCapacity", err)
	}
}

func TestIsGenreAgreesWithGenres(t *testing.T) {
	for _, genre := range domain.Genres() {
		if !domain.IsGenre(string(genre)) {
			t.Fatalf("IsGenre(%q) is false for a listed genre", genre)
		}
	}
	if domain.IsGenre("Shooter") || domain.IsGenre("") {
		t.Fatal("IsGenre accepted a value outside the list")
	}
}
