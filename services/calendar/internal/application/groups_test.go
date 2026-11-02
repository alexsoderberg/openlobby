package application_test

import (
	"context"
	"errors"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

type fakeGroups struct {
	groups []domain.Group
	err    error
	asked  string
}

func (f *fakeGroups) ListForUser(_ context.Context, userID string) ([]domain.Group, error) {
	f.asked = userID
	return f.groups, f.err
}

func TestListMineAsksRepositoryForTheCaller(t *testing.T) {
	repo := &fakeGroups{groups: []domain.Group{{ID: "g1", Name: "Friday"}}}

	got, err := application.NewGroups(repo).ListMine(context.Background(), "u1")

	if err != nil {
		t.Fatal(err)
	}
	if repo.asked != "u1" {
		t.Fatalf("repository asked for %q, want u1", repo.asked)
	}
	if len(got) != 1 || got[0].Name != "Friday" {
		t.Fatalf("groups %v, want the Friday group", got)
	}
}

func TestListMineIsEmptyForUserInNoGroup(t *testing.T) {
	got, err := application.NewGroups(&fakeGroups{}).ListMine(context.Background(), "u1")

	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("groups %v, want none", got)
	}
}

func TestListMineKeepsUnavailable(t *testing.T) {
	repo := &fakeGroups{err: domain.ErrUnavailable}

	_, err := application.NewGroups(repo).ListMine(context.Background(), "u1")

	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("error %v, want ErrUnavailable", err)
	}
}
