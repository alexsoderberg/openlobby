package application_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// fakeChoices keeps the choices in memory and, like the adapter, refuses an ID that is not an effective game role of
// the catalog, changing nothing.
type fakeChoices struct {
	catalog  *fakeCatalog
	stored   map[string][]string
	replaces int
}

func (f *fakeChoices) ChosenGameRoleIDs(_ context.Context, userID string) ([]string, error) {
	return slices.Clone(f.stored[userID]), nil
}

func (f *fakeChoices) Replace(_ context.Context, userID string, gameRoleIDs []string) error {
	f.replaces++
	effective := map[string]bool{}
	for _, game := range f.catalog.listed {
		for _, role := range game.EffectiveGameRoles() {
			effective[role.ID] = true
		}
	}
	for _, id := range gameRoleIDs {
		if !effective[id] {
			return domain.ErrInvalidGameRole
		}
	}
	f.stored[userID] = slices.Clone(gameRoleIDs)
	return nil
}

// choicesCatalog has a game with modes (and a hidden game-level role), a game without modes, and a game without roles,
// sorted as the catalog sorts them.
func choicesCatalog() *fakeCatalog {
	return &fakeCatalog{listed: []domain.Game{
		{ID: "g-chess", Name: "Chess", GameRoles: []domain.GameRole{}, Modes: []domain.GameMode{}},
		{ID: "g-raid", Name: "raid", GameRoles: []domain.GameRole{{ID: "hidden"}}, Modes: []domain.GameMode{
			{ID: "m-ranked", GameRoles: []domain.GameRole{}},
			{ID: "m-raid", GameRoles: []domain.GameRole{{ID: "tank"}, {ID: "healer"}}},
		}},
		{ID: "g-scout", Name: "Scout", GameRoles: []domain.GameRole{{ID: "scout"}}, Modes: []domain.GameMode{}},
	}}
}

func newPreferred(stored map[string][]string) (*application.PreferredGameRoles, *fakeChoices) {
	catalog := choicesCatalog()
	choices := &fakeChoices{catalog: catalog, stored: stored}
	return application.NewPreferredGameRoles(choices, catalog), choices
}

func gameIDs(games []domain.Game) []string {
	ids := make([]string, 0, len(games))
	for _, game := range games {
		ids = append(ids, game.ID)
	}
	return ids
}

// A person in no group reads their own choices: there is no membership check (ADR 0022 point 4).
func TestChoicesHideHiddenRolesAndGamesWithoutRoles(t *testing.T) {
	preferred, _ := newPreferred(map[string][]string{aliceID: {"scout", "hidden", "healer", "gone"}})

	got, err := preferred.Choices(context.Background(), aliceID)

	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(got.GameRoleIDs, []string{"healer", "scout"}) || !slices.Equal(gameIDs(got.Games), []string{"g-raid", "g-scout"}) {
		t.Fatalf("choices %v, games %v; want [healer scout] and [g-raid g-scout]", got.GameRoleIDs, gameIDs(got.Games))
	}
	if got.Games[0].GameRoles == nil || len(got.Games[0].GameRoles) != 0 || len(got.Games[1].GameRoles) != 1 {
		t.Fatalf("game-level roles %v and %v; want [] for the game with modes and its own for the other", got.Games[0].GameRoles, got.Games[1].GameRoles)
	}
}

func TestChoicesOfAPersonWithoutChoicesAreEmptyListsNotNil(t *testing.T) {
	preferred := application.NewPreferredGameRoles(&fakeChoices{catalog: &fakeCatalog{}, stored: map[string][]string{}}, &fakeCatalog{})

	got, err := preferred.Choices(context.Background(), bobID)

	if err != nil || got.GameRoleIDs == nil || got.Games == nil {
		t.Fatalf("choices %#v, error %v; want empty lists", got, err)
	}
}

func TestReplaceStoresAndReturnsTheStoredState(t *testing.T) {
	preferred, choices := newPreferred(map[string][]string{aliceID: {"tank"}})

	got, err := preferred.Replace(context.Background(), bobID, []string{"scout", "healer"})

	if err != nil || !slices.Equal(got.GameRoleIDs, []string{"healer", "scout"}) || len(got.Games) != 2 {
		t.Fatalf("choices %v, error %v; want [healer scout] with the games", got.GameRoleIDs, err)
	}
	if !slices.Equal(choices.stored[aliceID], []string{"tank"}) {
		t.Fatalf("another person's choices changed to %v", choices.stored[aliceID])
	}
}

func TestReplaceWithAnEmptyListClears(t *testing.T) {
	preferred, choices := newPreferred(map[string][]string{aliceID: {"tank"}})

	got, err := preferred.Replace(context.Background(), aliceID, []string{})

	if err != nil || len(got.GameRoleIDs) != 0 || len(choices.stored[aliceID]) != 0 {
		t.Fatalf("choices %v (stored %v), error %v; want none", got.GameRoleIDs, choices.stored[aliceID], err)
	}
}

func TestReplaceRefusals(t *testing.T) {
	tests := []struct {
		name         string
		ids          []string
		want         error
		reachesStore bool
	}{
		{name: "missing or null list", ids: nil, want: domain.ErrInvalidID},
		{name: "unknown ID", ids: []string{"tank", "gone"}, want: domain.ErrInvalidGameRole, reachesStore: true},
		{name: "game-level role of a game with modes", ids: []string{"hidden"}, want: domain.ErrInvalidGameRole, reachesStore: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			preferred, choices := newPreferred(map[string][]string{aliceID: {"tank"}})

			_, err := preferred.Replace(context.Background(), aliceID, tc.ids)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if (choices.replaces > 0) != tc.reachesStore || !slices.Equal(choices.stored[aliceID], []string{"tank"}) {
				t.Fatalf("store called %d times, stored %v; want the choices kept", choices.replaces, choices.stored[aliceID])
			}
		})
	}
}
