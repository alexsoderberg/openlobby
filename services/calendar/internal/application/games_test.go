package application_test

import (
	"context"
	"errors"
	"slices"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// fakeCatalog returns the usages it holds and counts the reads, so a test can show that a non-member's read never ran.
type fakeCatalog struct {
	usages    []application.GameUsage
	err       error
	calls     int
	asked     string
	listed    []domain.Game
	listErr   error
	listCalls int
}

func (c *fakeCatalog) ListForGroup(_ context.Context, groupID string) ([]application.GameUsage, error) {
	c.calls++
	c.asked = groupID
	return slices.Clone(c.usages), c.err
}

func (c *fakeCatalog) List(_ context.Context) ([]domain.Game, error) {
	c.listCalls++
	return slices.Clone(c.listed), c.listErr
}

func newGames(store *fakeStore, catalog *fakeCatalog) *application.Games {
	return application.NewGames(store, catalog, &fakeEditor{}, discardLog())
}

func gameUsage(id, name string, lobbies int) application.GameUsage {
	return application.GameUsage{Game: domain.Game{ID: id, Name: name}, LobbyCount: lobbies}
}

// Most used first: a higher count wins, then the name ignoring case, then the ID (ADR 0010).
func TestListGroupGamesOrdersMostUsedFirstThenNameThenID(t *testing.T) {
	store := &fakeStore{members: map[string][]domain.Member{fridayID: {{UserID: aliceID, Role: domain.RoleMember}}}}
	catalog := &fakeCatalog{usages: []application.GameUsage{
		gameUsage("g3", "Zelda", 0),
		gameUsage("g1", "overwatch", 2),
		gameUsage("g2", "Apex", 0),
		gameUsage("g5", "chess", 0),
		gameUsage("g0", "Counter", 1),
		gameUsage("g4", "Chess", 0),
	}}

	got, err := newGames(store, catalog).ListGroupGames(context.Background(), fridayID, aliceID)

	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, game := range got {
		ids = append(ids, game.ID)
	}
	want := []string{"g1", "g0", "g2", "g4", "g5", "g3"}
	if !slices.Equal(ids, want) {
		t.Fatalf("order %v, want %v", ids, want)
	}
	if catalog.asked != fridayID {
		t.Fatalf("catalog asked for group %q, want %q", catalog.asked, fridayID)
	}
}

func TestListGroupGamesRefusesNonMemberWithoutReadingTheCatalog(t *testing.T) {
	store := &fakeStore{members: map[string][]domain.Member{fridayID: {{UserID: aliceID, Role: domain.RoleMember}}}}
	catalog := &fakeCatalog{usages: []application.GameUsage{gameUsage(newID, "Chess", 0)}}

	_, err := newGames(store, catalog).ListGroupGames(context.Background(), fridayID, bobID)

	if !errors.Is(err, domain.ErrGroupNotFound) {
		t.Fatalf("error %v, want ErrGroupNotFound", err)
	}
	if catalog.calls != 0 {
		t.Fatalf("catalog read %d times for a non-member", catalog.calls)
	}
}

func TestListGroupGamesKeepsUnavailable(t *testing.T) {
	store := &fakeStore{err: domain.ErrUnavailable}

	_, err := newGames(store, &fakeCatalog{}).ListGroupGames(context.Background(), fridayID, aliceID)
	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("membership error %v, want ErrUnavailable", err)
	}

	catalog := &fakeCatalog{err: domain.ErrUnavailable}
	store = &fakeStore{members: map[string][]domain.Member{fridayID: {{UserID: aliceID}}}}
	_, err = newGames(store, catalog).ListGroupGames(context.Background(), fridayID, aliceID)
	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("catalog error %v, want ErrUnavailable", err)
	}
}
