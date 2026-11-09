package application_test

import (
	"context"
	"errors"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

var (
	tankRole  = []domain.GameRole{{Name: "Tank", Slots: 1}}
	rankedMax = []domain.GameMode{{Name: "Ranked", MaxPlayers: fiveMax}}
)

// The admin check comes before the roles and modes are checked, and nothing is written (ADR 0017 tests).
func TestGameWritesWithRolesAndModesAreDeniedToNonAdmin(t *testing.T) {
	editor := &fakeEditor{games: []domain.Game{{ID: gameID, Name: chessName}}}
	games := newAdminGames(&fakeCatalog{}, editor)
	invalid := []domain.GameMode{{Name: ""}}

	_, createErr := games.CreateGame(context.Background(), nonAdmin, chessName, nil, nil, tankRole, rankedMax)
	_, replaceErr := games.ReplaceGame(context.Background(), nonAdmin, gameID, chessName, nil, nil, tankRole, invalid)

	if !errors.Is(createErr, domain.ErrNotAllowed) || !errors.Is(replaceErr, domain.ErrNotAllowed) || editor.calls != 0 {
		t.Fatalf("errors %v and %v, editor calls %d; want ErrNotAllowed and no write", createErr, replaceErr, editor.calls)
	}
}

func TestGameWritesRefuseInvalidRolesAndModesBeforeAnyWrite(t *testing.T) {
	tests := []struct {
		name  string
		roles []domain.GameRole
		modes []domain.GameMode
		want  error
	}{
		{name: "role", roles: []domain.GameRole{{Name: " ", Slots: 1}}, want: domain.ErrInvalidGameRole},
		{name: "slots", roles: []domain.GameRole{{Name: "Tank"}}, want: domain.ErrInvalidCapacity},
		{name: "mode", modes: []domain.GameMode{{Name: " ", MaxPlayers: fiveMax}}, want: domain.ErrInvalidMode},
		{name: "mode capacity", modes: []domain.GameMode{{Name: "Ranked"}}, want: domain.ErrInvalidCapacity},
		{name: "activity", modes: []domain.GameMode{{Name: "Ranked", MaxPlayers: fiveMax, Activities: []domain.Activity{{Name: ""}}}}, want: domain.ErrInvalidActivity},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			editor := &fakeEditor{games: []domain.Game{{ID: gameID, Name: chessName}}}
			games := newAdminGames(&fakeCatalog{}, editor)

			_, createErr := games.CreateGame(context.Background(), admin, "Other Chess", nil, nil, tc.roles, tc.modes)
			_, replaceErr := games.ReplaceGame(context.Background(), admin, gameID, chessName, nil, nil, tc.roles, tc.modes)

			if !errors.Is(createErr, tc.want) || !errors.Is(replaceErr, tc.want) || editor.calls != 0 {
				t.Fatalf("errors %v and %v, editor calls %d; want %v and no write", createErr, replaceErr, editor.calls, tc.want)
			}
		})
	}
}

// ReplaceGame hands the editor nil lists when the request omits them, so the stored ones stay.
func TestReplaceGameKeepsOmittedListsNilAndPassesGivenOnes(t *testing.T) {
	editor := &fakeEditor{games: []domain.Game{{ID: gameID, Name: chessName}}}
	games := newAdminGames(&fakeCatalog{}, editor)

	if _, err := games.ReplaceGame(context.Background(), admin, gameID, chessName, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if editor.games[0].GameRoles != nil || editor.games[0].Modes != nil {
		t.Fatalf("omitted lists became %+v; want nil", editor.games[0])
	}
	if _, err := games.ReplaceGame(context.Background(), admin, gameID, chessName, nil, nil, []domain.GameRole{}, rankedMax); err != nil {
		t.Fatal(err)
	}
	if editor.games[0].GameRoles == nil || len(editor.games[0].Modes) != 1 {
		t.Fatalf("given lists became %+v", editor.games[0])
	}
}
