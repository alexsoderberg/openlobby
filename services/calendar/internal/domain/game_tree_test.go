package domain_test

import (
	"errors"
	"math"
	"slices"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

func roles(slots ...int) []domain.GameRole {
	list := make([]domain.GameRole, 0, len(slots))
	for i, count := range slots {
		list = append(list, domain.GameRole{Name: string(rune('A' + i)), Slots: count})
	}
	return list
}

func newGameWithRoles(raw []domain.GameRole) (domain.Game, error) {
	return domain.NewGame("", "Chess", nil, nil, raw, nil)
}

func newGameWithMode(mode domain.GameMode) (domain.Game, error) {
	return domain.NewGame("", "Chess", nil, nil, nil, []domain.GameMode{mode})
}

func TestGameRoleRules(t *testing.T) {
	tests := []struct {
		name string
		raw  []domain.GameRole
		want error
	}{
		{name: "valid roles", raw: roles(1, 2)},
		{name: "empty list is valid", raw: []domain.GameRole{}},
		{name: "name of 30 characters", raw: []domain.GameRole{{Name: strings.Repeat("a", 30), Slots: 1}}},
		{name: "name of 31 characters", raw: []domain.GameRole{{Name: strings.Repeat("a", 31), Slots: 1}}, want: domain.ErrInvalidGameRole},
		{name: "name empty after trim", raw: []domain.GameRole{{Name: "  ", Slots: 1}}, want: domain.ErrInvalidGameRole},
		{name: "zero slots", raw: roles(0), want: domain.ErrInvalidCapacity},
		{name: "negative slots", raw: roles(-1), want: domain.ErrInvalidCapacity},
		{name: "slots above the limit", raw: roles(math.MaxInt32 + 1), want: domain.ErrInvalidCapacity},
		{name: "sum at the limit", raw: roles(math.MaxInt32-1, 1)},
		{name: "sum above the limit", raw: roles(math.MaxInt32, 1), want: domain.ErrInvalidCapacity},
		{name: "name is checked before slots", raw: []domain.GameRole{{Name: "", Slots: 0}}, want: domain.ErrInvalidGameRole},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := newGameWithRoles(tc.raw)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
		})
	}
}

func TestOmittedListsStayNilAndEmptyListsStayEmpty(t *testing.T) {
	omitted, _ := domain.NewGame("", "Chess", nil, nil, nil, nil)
	empty, _ := domain.NewGame("", "Chess", nil, nil, []domain.GameRole{}, []domain.GameMode{})

	if omitted.GameRoles != nil || omitted.Modes != nil {
		t.Fatalf("omitted lists are %v and %v, want nil", omitted.GameRoles, omitted.Modes)
	}
	if empty.GameRoles == nil || empty.Modes == nil {
		t.Fatal("empty lists became nil, which would mean unchanged")
	}
}

func TestGameRoleNameIsTrimmedAndIDKept(t *testing.T) {
	game, err := newGameWithRoles([]domain.GameRole{{ID: "r1", Name: "  Tank ", Slots: 1}})

	if err != nil || game.GameRoles[0] != (domain.GameRole{ID: "r1", Name: "Tank", Slots: 1}) {
		t.Fatalf("roles %v, error %v", game.GameRoles, err)
	}
}

func TestModeRules(t *testing.T) {
	five := 5
	zero := 0
	tooBig := math.MaxInt32 + 1
	tests := []struct {
		name string
		mode domain.GameMode
		want error
	}{
		{name: "mode with a max", mode: domain.GameMode{Name: "Ranked", MaxPlayers: &five}},
		{name: "mode with roles", mode: domain.GameMode{Name: "Raid", GameRoles: roles(1, 4)}},
		{name: "name of 50 characters", mode: domain.GameMode{Name: strings.Repeat("a", 50), MaxPlayers: &five}},
		{name: "name of 51 characters", mode: domain.GameMode{Name: strings.Repeat("a", 51), MaxPlayers: &five}, want: domain.ErrInvalidMode},
		{name: "name empty after trim", mode: domain.GameMode{Name: " ", MaxPlayers: &five}, want: domain.ErrInvalidMode},
		{name: "no max and no roles", mode: domain.GameMode{Name: "Ranked"}, want: domain.ErrInvalidCapacity},
		{name: "empty role list and no max", mode: domain.GameMode{Name: "Ranked", GameRoles: []domain.GameRole{}}, want: domain.ErrInvalidCapacity},
		{name: "max of zero", mode: domain.GameMode{Name: "Ranked", MaxPlayers: &zero}, want: domain.ErrInvalidCapacity},
		{name: "max above the limit", mode: domain.GameMode{Name: "Ranked", MaxPlayers: &tooBig}, want: domain.ErrInvalidCapacity},
		{name: "max and roles", mode: domain.GameMode{Name: "Raid", MaxPlayers: &five, GameRoles: roles(5)}, want: domain.ErrInvalidCapacity},
		{name: "invalid role", mode: domain.GameMode{Name: "Raid", GameRoles: []domain.GameRole{{Name: "", Slots: 1}}}, want: domain.ErrInvalidGameRole},
		{name: "invalid slots", mode: domain.GameMode{Name: "Raid", GameRoles: roles(0)}, want: domain.ErrInvalidCapacity},
		{name: "invalid activity", mode: domain.GameMode{Name: "Raid", MaxPlayers: &five, Activities: []domain.Activity{{Name: ""}}}, want: domain.ErrInvalidActivity},
		{name: "activity of 51 characters", mode: domain.GameMode{Name: "Raid", MaxPlayers: &five, Activities: []domain.Activity{{Name: strings.Repeat("a", 51)}}}, want: domain.ErrInvalidActivity},
		{name: "activity before mode name", mode: domain.GameMode{Name: "", MaxPlayers: &five, Activities: []domain.Activity{{Name: ""}}}, want: domain.ErrInvalidActivity},
		{name: "role before activity", mode: domain.GameMode{Name: "Raid", GameRoles: []domain.GameRole{{Name: ""}}, Activities: []domain.Activity{{Name: ""}}}, want: domain.ErrInvalidGameRole},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := newGameWithMode(tc.mode)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
		})
	}
}

func TestModeWithRolesStoresTheSum(t *testing.T) {
	game, err := newGameWithMode(domain.GameMode{Name: " Raid ", GameRoles: roles(1, 4), Activities: []domain.Activity{{Name: " Vault "}}})

	mode := game.Modes[0]
	if err != nil || mode.Name != "Raid" || *mode.MaxPlayers != 5 || mode.Activities[0].Name != "Vault" {
		t.Fatalf("mode %+v, error %v", mode, err)
	}
}

func TestGameChecksComeBeforeTheNewRules(t *testing.T) {
	bad := domain.Genre("nope")

	_, errGenre := domain.NewGame("", "Chess", nil, &bad, roles(0), nil)
	_, errCapacity := domain.NewGame("", "Chess", nil, nil, roles(0), []domain.GameMode{{Name: ""}})

	if !errors.Is(errGenre, domain.ErrInvalidGenre) || !errors.Is(errCapacity, domain.ErrInvalidCapacity) {
		t.Fatalf("errors %v and %v", errGenre, errCapacity)
	}
}

func TestEffectiveDefaultMax(t *testing.T) {
	five, six := 5, 6
	withRoles := domain.Game{GameRoles: roles(2, 3)}
	withModes := domain.Game{Modes: []domain.GameMode{{Name: "Ranked", MaxPlayers: &five}}}
	tests := []struct {
		name    string
		game    domain.Game
		current domain.Game
		want    *int
		wantErr error
	}{
		{name: "no roles keeps the value", game: domain.Game{DefaultMaxPlayers: &six}, want: &six},
		{name: "no roles and no value is unlimited", game: domain.Game{}},
		{name: "roles with no value store the sum", game: withRoles, want: &five},
		{name: "roles with the sum", game: domain.Game{DefaultMaxPlayers: &five, GameRoles: roles(2, 3)}, want: &five},
		{name: "roles with another value", game: domain.Game{DefaultMaxPlayers: &six, GameRoles: roles(2, 3)}, wantErr: domain.ErrInvalidCapacity},
		{name: "omitted roles come from the stored game", game: domain.Game{DefaultMaxPlayers: &five}, current: withRoles, want: &five},
		{name: "omitted roles and another value", game: domain.Game{DefaultMaxPlayers: &six}, current: withRoles, wantErr: domain.ErrInvalidCapacity},
		{name: "removed roles free the value", game: domain.Game{DefaultMaxPlayers: &six, GameRoles: []domain.GameRole{}}, current: withRoles, want: &six},
		{name: "a game with modes keeps the value", game: domain.Game{DefaultMaxPlayers: &six, GameRoles: roles(2, 3), Modes: withModes.Modes}, want: &six},
		{name: "stored modes count when modes are omitted", game: domain.Game{DefaultMaxPlayers: &six, GameRoles: roles(2, 3)}, current: withModes, want: &six},
		{name: "removed modes bring the roles back", game: domain.Game{DefaultMaxPlayers: &six, Modes: []domain.GameMode{}}, current: domain.Game{GameRoles: roles(2, 3), Modes: withModes.Modes}, wantErr: domain.ErrInvalidCapacity},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := tc.game.EffectiveDefaultMax(tc.current)

			if !errors.Is(err, tc.wantErr) || (got == nil) != (tc.want == nil) || (got != nil && *got != *tc.want) {
				t.Fatalf("got %v, error %v; want %v, %v", got, err, tc.want, tc.wantErr)
			}
		})
	}
}

func TestCheckIDs(t *testing.T) {
	current := domain.Game{
		GameRoles: []domain.GameRole{{ID: "gr1"}},
		Modes: []domain.GameMode{
			{ID: "m1", GameRoles: []domain.GameRole{{ID: "r1"}}, Activities: []domain.Activity{{ID: "a1"}}},
			{ID: "m2", GameRoles: []domain.GameRole{{ID: "r2"}}, Activities: []domain.Activity{{ID: "a2"}}},
		},
	}
	tests := []struct {
		name string
		game domain.Game
		want error
	}{
		{name: "nothing given"},
		{name: "entries without IDs", game: domain.Game{Modes: []domain.GameMode{{Name: "x", GameRoles: roles(1)}}}},
		{name: "own IDs", game: domain.Game{GameRoles: []domain.GameRole{{ID: "gr1"}}, Modes: []domain.GameMode{{ID: "m1", GameRoles: []domain.GameRole{{ID: "r1"}}, Activities: []domain.Activity{{ID: "a1"}}}}}},
		{name: "unknown mode", game: domain.Game{Modes: []domain.GameMode{{ID: "x"}}}, want: domain.ErrInvalidID},
		{name: "duplicate mode", game: domain.Game{Modes: []domain.GameMode{{ID: "m1"}, {ID: "m1"}}}, want: domain.ErrInvalidID},
		{name: "game role of a mode in the game list", game: domain.Game{GameRoles: []domain.GameRole{{ID: "r1"}}}, want: domain.ErrInvalidID},
		{name: "role of another mode", game: domain.Game{Modes: []domain.GameMode{{ID: "m1", GameRoles: []domain.GameRole{{ID: "r2"}}}}}, want: domain.ErrInvalidID},
		{name: "activity of another mode", game: domain.Game{Modes: []domain.GameMode{{ID: "m1", Activities: []domain.Activity{{ID: "a2"}}}}}, want: domain.ErrInvalidID},
		{name: "ID inside a new mode", game: domain.Game{Modes: []domain.GameMode{{GameRoles: []domain.GameRole{{ID: "r1"}}}}}, want: domain.ErrInvalidID},
		{name: "same role in two modes", game: domain.Game{Modes: []domain.GameMode{{ID: "m1", GameRoles: []domain.GameRole{{ID: "r1"}}}, {ID: "m2", GameRoles: []domain.GameRole{{ID: "r1"}}}}}, want: domain.ErrInvalidID},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if err := tc.game.CheckIDs(current); !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
		})
	}
}

func TestEffectiveGameRoles(t *testing.T) {
	scout, tank, healer := domain.GameRole{ID: "scout"}, domain.GameRole{ID: "tank"}, domain.GameRole{ID: "healer"}
	tests := []struct {
		name string
		game domain.Game
		want []string
	}{
		{name: "no modes: the game's roles", game: domain.Game{GameRoles: []domain.GameRole{scout}}, want: []string{"scout"}},
		{name: "modes hide the game-level roles", game: domain.Game{GameRoles: []domain.GameRole{scout}, Modes: []domain.GameMode{
			{GameRoles: []domain.GameRole{tank}}, {}, {GameRoles: []domain.GameRole{healer}},
		}}, want: []string{"tank", "healer"}},
		{name: "modes without roles: none", game: domain.Game{GameRoles: []domain.GameRole{scout}, Modes: []domain.GameMode{{}}}, want: nil},
		{name: "no roles at all", game: domain.Game{}, want: nil},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var got []string
			for _, role := range tc.game.EffectiveGameRoles() {
				got = append(got, role.ID)
			}
			if !slices.Equal(got, tc.want) {
				t.Fatalf("roles %v, want %v", got, tc.want)
			}
		})
	}
}
