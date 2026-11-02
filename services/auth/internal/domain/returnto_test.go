package domain

import "testing"

func TestSafeReturnTo(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "root", raw: "/", want: "/"},
		{name: "group path", raw: "/groups/123", want: "/groups/123"},
		{name: "invite path with query", raw: "/invite/abc?x=1", want: "/invite/abc?x=1"},
		{name: "empty", raw: "", want: "/"},
		{name: "protocol relative", raw: "//evil.example", want: "/"},
		{name: "triple slash", raw: "///evil.example", want: "/"},
		{name: "backslash after slash", raw: `/\evil.example`, want: "/"},
		{name: "backslash first", raw: `\evil.example`, want: "/"},
		{name: "absolute url", raw: "https://evil.example", want: "/"},
		{name: "tab after slash", raw: "/\t/evil.example", want: "/"},
		{name: "newline after slash", raw: "/\n/evil.example", want: "/"},
		{name: "space", raw: "/groups/1 2", want: "/"},
		{name: "control character", raw: "/groups/\x7f", want: "/"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := SafeReturnTo(tc.raw); got != tc.want {
				t.Fatalf("SafeReturnTo(%q) = %q, want %q", tc.raw, got, tc.want)
			}
		})
	}
}
