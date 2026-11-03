package domain_test

import (
	"errors"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

// The length rule of REQ-0002: 1 to 50 characters after trim, counted in code points.
func TestNewGroupNameAcceptsValidNames(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "one character", raw: "a", want: "a"},
		{name: "fifty characters", raw: strings.Repeat("a", 50), want: strings.Repeat("a", 50)},
		{name: "spaces around are trimmed", raw: "  Friday  ", want: "Friday"},
		{name: "fifty characters after trim", raw: "  " + strings.Repeat("a", 50) + "  ", want: strings.Repeat("a", 50)},
		{name: "fifty code points of two bytes each", raw: strings.Repeat("å", 50), want: strings.Repeat("å", 50)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := domain.NewGroupName(tc.raw)

			if err != nil || got != tc.want {
				t.Fatalf("name %q, error %v; want %q", got, err, tc.want)
			}
		})
	}
}

func TestNewGroupNameRejectsInvalidNames(t *testing.T) {
	tests := []struct {
		name string
		raw  string
	}{
		{name: "fifty-one characters", raw: strings.Repeat("a", 51)},
		{name: "empty", raw: ""},
		{name: "only spaces", raw: "   "},
		{name: "only tabs and newlines", raw: "\t\n"},
		{name: "fifty-one code points of two bytes each", raw: strings.Repeat("å", 51)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := domain.NewGroupName(tc.raw)

			if !errors.Is(err, domain.ErrInvalidGroupName) {
				t.Fatalf("error %v, want ErrInvalidGroupName", err)
			}
		})
	}
}
