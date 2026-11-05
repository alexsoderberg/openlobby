package domain_test

import (
	"errors"
	"strings"
	"testing"
	"time"

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

func TestNewInviteLinkMaxUses(t *testing.T) {
	intPtr := func(value int) *int { return &value }
	tests := []struct {
		name      string
		requested *int
		want      domain.InviteLinkMaxUses
		wantErr   bool
	}{
		{name: "omitted gives the default of 1", requested: nil, want: 1},
		{name: "lowest allowed value 1", requested: intPtr(1), want: 1},
		{name: "highest allowed value 10", requested: intPtr(10), want: 10},
		{name: "middle value", requested: intPtr(5), want: 5},
		{name: "zero is below the range", requested: intPtr(0), wantErr: true},
		{name: "eleven is above the range", requested: intPtr(11), wantErr: true},
		{name: "minus two is below the range", requested: intPtr(-2), wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := domain.NewInviteLinkMaxUses(tc.requested)

			if tc.wantErr {
				if !errors.Is(err, domain.ErrInvalidMaxUses) {
					t.Fatalf("error %v, want ErrInvalidMaxUses", err)
				}
				return
			}
			if err != nil || got != tc.want {
				t.Fatalf("max uses %d, error %v; want %d", got, err, tc.want)
			}
		})
	}
}

func TestInviteLinkIsActive(t *testing.T) {
	now := time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name string
		link domain.InviteLink
		want bool
	}{
		{name: "fresh link with uses left", link: domain.InviteLink{ExpiresAt: now.Add(time.Second), MaxUses: 1}, want: true},
		{name: "one nanosecond before expiry", link: domain.InviteLink{ExpiresAt: now.Add(time.Nanosecond), MaxUses: 1}, want: true},
		{name: "exactly at expiry is not active", link: domain.InviteLink{ExpiresAt: now, MaxUses: 1}, want: false},
		{name: "after expiry is not active", link: domain.InviteLink{ExpiresAt: now.Add(-time.Second), MaxUses: 1}, want: false},
		{name: "created 9 minutes ago is active", link: domain.InviteLink{ExpiresAt: now.Add(-9 * time.Minute).Add(domain.InviteLinkLifetime), MaxUses: 1}, want: true},
		{name: "created exactly 10 minutes ago is not active", link: domain.InviteLink{ExpiresAt: now.Add(-10 * time.Minute).Add(domain.InviteLinkLifetime), MaxUses: 1}, want: false},
		{name: "one use left of ten", link: domain.InviteLink{ExpiresAt: now.Add(time.Hour), UseCount: 9, MaxUses: 10}, want: true},
		{name: "use count equals max uses is not active", link: domain.InviteLink{ExpiresAt: now.Add(time.Hour), UseCount: 10, MaxUses: 10}, want: false},
		{name: "use count of one with max one is not active", link: domain.InviteLink{ExpiresAt: now.Add(time.Hour), UseCount: 1, MaxUses: 1}, want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.link.IsActive(now); got != tc.want {
				t.Fatalf("IsActive = %v, want %v", got, tc.want)
			}
		})
	}
}
