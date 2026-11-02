package domain

import "testing"

func TestParseSystemAdmins(t *testing.T) {
	tests := []struct {
		name    string
		raw     string
		wantErr bool
		admins  int
	}{
		{name: "empty means none", raw: "", admins: 0},
		{name: "one admin", raw: "discord:111", admins: 1},
		{name: "two admins with spaces", raw: "discord:111, discord:222", admins: 2},
		{name: "unknown provider", raw: "github:111", wantErr: true},
		{name: "missing subject", raw: "discord:", wantErr: true},
		{name: "missing provider separator", raw: "111", wantErr: true},
		{name: "empty entry", raw: "discord:111,", wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			admins, err := ParseSystemAdmins(tc.raw, []string{"discord"})
			if (err != nil) != tc.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tc.wantErr)
			}
			if err == nil && len(admins) != tc.admins {
				t.Fatalf("got %d admins, want %d", len(admins), tc.admins)
			}
		})
	}
}

func TestSystemAdminsIncludes(t *testing.T) {
	admins, err := ParseSystemAdmins("discord:111", []string{"discord"})
	if err != nil {
		t.Fatal(err)
	}
	tests := []struct {
		name string
		user User
		want bool
	}{
		{name: "listed user", user: User{Provider: "discord", ProviderSubjectID: "111"}, want: true},
		{name: "other subject", user: User{Provider: "discord", ProviderSubjectID: "222"}},
		{name: "other provider with same subject", user: User{Provider: "other", ProviderSubjectID: "111"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := admins.Includes(tc.user); got != tc.want {
				t.Fatalf("Includes = %v, want %v", got, tc.want)
			}
		})
	}
}
