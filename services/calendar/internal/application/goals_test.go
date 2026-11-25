package application_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// fakeGoals keeps the goals in memory and records the owner of each write, so a test can show who the goal is for.
type fakeGoals struct {
	games  []domain.GameGoals
	err    error
	writes []string
}

func (f *fakeGoals) GameGoals(context.Context, string) ([]domain.GameGoals, error) {
	return f.games, f.err
}

func (f *fakeGoals) AddGoal(_ context.Context, userID, _ string, _ domain.ItemID) error {
	f.writes = append(f.writes, userID)
	return f.err
}

func (f *fakeGoals) RemoveGoal(_ context.Context, userID, _ string, _ domain.ItemID) error {
	f.writes = append(f.writes, userID)
	return f.err
}

func newGoals(goals *fakeGoals, catalog *fakeItemCatalog) *application.Goals {
	return application.NewGoals(goals, application.NewItems(nil, catalog, discardLog()))
}

// The names are resolved within the budget, each item ID once, and the games keep their order (ADR 0029 section 5).
func TestListGoalsResolvesTheNames(t *testing.T) {
	catalog := dropCatalog()
	goals := &fakeGoals{games: []domain.GameGoals{
		{GameID: gameID, GameName: "WoW", Goals: []domain.GameItem{{Item: domain.Item{ID: 1}, DropsIn: []domain.DropActivity{moltenCore}}, {Item: domain.Item{ID: 3}}}},
		{GameID: chessID, GameName: "Chess", Goals: []domain.GameItem{{Item: domain.Item{ID: 1}}, {Item: domain.Item{ID: 2}}}},
	}}

	games, err := newGoals(goals, catalog).List(context.Background(), aliceID)

	want := []domain.GameGoals{
		{GameID: gameID, GameName: "WoW", Goals: []domain.GameItem{
			{Item: domain.Item{ID: 1, Name: "Thunderfury", Status: domain.ItemKnown}, DropsIn: []domain.DropActivity{moltenCore}},
			{Item: domain.Item{ID: 3, Status: domain.ItemUnavailable}},
		}},
		{GameID: chessID, GameName: "Chess", Goals: []domain.GameItem{
			{Item: domain.Item{ID: 1, Name: "Thunderfury", Status: domain.ItemKnown}},
			{Item: domain.Item{ID: 2, Status: domain.ItemUnknown}},
		}},
	}
	if err != nil || !reflect.DeepEqual(games, want) {
		t.Fatalf("games %+v, error %v; want %+v", games, err, want)
	}
	if catalog.calls != 3 {
		t.Fatalf("catalog calls %d; want one per item ID", catalog.calls)
	}
}

func TestListGoalsPassesTheRepositoryError(t *testing.T) {
	_, err := newGoals(&fakeGoals{err: domain.ErrUnavailable}, dropCatalog()).List(context.Background(), aliceID)

	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("error %v; want ErrUnavailable", err)
	}
}

// The goal is always the caller's, and an invalid item ID is refused before the repository (ADR 0029 sections 5 and 8).
func TestGoalWrites(t *testing.T) {
	tests := []struct {
		name      string
		item      string
		repoErr   error
		want      error
		wantWrite bool
	}{
		{name: "stored for the caller", item: "1", wantWrite: true},
		{name: "invalid item", item: "0", want: domain.ErrInvalidItem},
		{name: "item not a number", item: "x", want: domain.ErrInvalidItem},
		{name: "unknown game", item: "1", repoErr: application.ErrGameNotFound, want: application.ErrGameNotFound, wantWrite: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			addRepo, removeRepo := &fakeGoals{err: tc.repoErr}, &fakeGoals{err: tc.repoErr}

			addErr := newGoals(addRepo, dropCatalog()).Add(context.Background(), bobID, gameID, tc.item)
			removeErr := newGoals(removeRepo, dropCatalog()).Remove(context.Background(), bobID, gameID, tc.item)

			if !errors.Is(addErr, tc.want) || !errors.Is(removeErr, tc.want) {
				t.Fatalf("add %v, remove %v; want %v", addErr, removeErr, tc.want)
			}
			want := []string(nil)
			if tc.wantWrite {
				want = []string{bobID}
			}
			if !reflect.DeepEqual(addRepo.writes, want) || !reflect.DeepEqual(removeRepo.writes, want) {
				t.Fatalf("writes %v and %v; want %v", addRepo.writes, removeRepo.writes, want)
			}
		})
	}
}

// An item on no drop list of the game is refused by the repository (ADR 0029 section 5).
func TestAddGoalPassesNotOnADropList(t *testing.T) {
	err := newGoals(&fakeGoals{err: domain.ErrInvalidItem}, dropCatalog()).Add(context.Background(), bobID, gameID, "7")

	if !errors.Is(err, domain.ErrInvalidItem) {
		t.Fatalf("error %v; want ErrInvalidItem", err)
	}
}
