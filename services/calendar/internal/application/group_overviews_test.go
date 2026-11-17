package application_test

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

func TestListOverviewsWithoutGroupsAsksNoNames(t *testing.T) {
	store, directory := &fakeStore{}, &fakeDirectory{}

	got, err := newGroups(store, directory).ListOverviews(context.Background(), aliceID)

	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 || directory.calls != 0 {
		t.Fatalf("overviews %v and %d names calls, want none and none", got, directory.calls)
	}
}

func TestListOverviewsPassesTheCallerAndTheClockTime(t *testing.T) {
	store := &fakeStore{}

	if _, err := newGroups(store, &fakeDirectory{}).ListOverviews(context.Background(), aliceID); err != nil {
		t.Fatal(err)
	}
	if store.asked != aliceID || !store.overviewsAt.Equal(now) {
		t.Fatalf("reader asked for %q at %v, want %q at %v", store.asked, store.overviewsAt, aliceID, now)
	}
}

func TestListOverviewsFillsTheNamesInOrderWithOneCall(t *testing.T) {
	store := &fakeStore{overviews: []domain.GroupOverview{
		{Group: domain.Group{ID: fridayID, Name: "Friday"}, MemberCount: 2, Members: []domain.Member{{UserID: bobID}, {UserID: aliceID}}},
		{Group: domain.Group{ID: emptyID, Name: "Sunday"}, MemberCount: 1, Members: []domain.Member{{UserID: aliceID}}},
	}}
	directory := &fakeDirectory{names: map[string]string{aliceID: "Alex", bobID: "Bo"}}

	got, err := newGroups(store, directory).ListOverviews(context.Background(), aliceID)

	if err != nil {
		t.Fatal(err)
	}
	if directory.calls != 1 || len(directory.asked) != 2 {
		t.Fatalf("%d names calls for %v, want 1 call that asks each user once", directory.calls, directory.asked)
	}
	want := [][]domain.Member{{{UserID: bobID, DisplayName: "Bo"}, {UserID: aliceID, DisplayName: "Alex"}}, {{UserID: aliceID, DisplayName: "Alex"}}}
	for i, overview := range got {
		if !reflect.DeepEqual(overview.Members, want[i]) {
			t.Errorf("group %s members %v, want %v", overview.Group.Name, overview.Members, want[i])
		}
	}
}

func TestListOverviewsReturnsTheErrors(t *testing.T) {
	overview := domain.GroupOverview{Group: domain.Group{ID: fridayID}, MemberCount: 1, Members: []domain.Member{{UserID: aliceID}}}
	tests := []struct {
		name      string
		store     *fakeStore
		directory *fakeDirectory
	}{
		{name: "reader", store: &fakeStore{err: domain.ErrUnavailable}, directory: &fakeDirectory{}},
		{name: "auth", store: &fakeStore{overviews: []domain.GroupOverview{overview}}, directory: &fakeDirectory{err: domain.ErrUnavailable}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := newGroups(tc.store, tc.directory).ListOverviews(context.Background(), aliceID)
			if !errors.Is(err, domain.ErrUnavailable) {
				t.Fatalf("error %v, want ErrUnavailable", err)
			}
		})
	}
}
