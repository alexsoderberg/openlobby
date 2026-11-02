package domain

import (
	"testing"
	"time"
)

func TestSessionLifetime(t *testing.T) {
	created := time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)
	expires := SessionExpiry(created)

	if got := expires.Sub(created); got != 30*24*time.Hour {
		t.Fatalf("lifetime %v, want 30 days", got)
	}
	session := Session{UserID: "u", ExpiresAt: expires}
	tests := []struct {
		name string
		now  time.Time
		want bool
	}{
		{name: "just after login", now: created.Add(time.Minute), want: true},
		{name: "one second before expiry", now: expires.Add(-time.Second), want: true},
		{name: "at expiry", now: expires, want: false},
		{name: "after expiry", now: expires.Add(time.Hour), want: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := session.ActiveAt(tc.now); got != tc.want {
				t.Fatalf("ActiveAt = %v, want %v", got, tc.want)
			}
		})
	}
}
