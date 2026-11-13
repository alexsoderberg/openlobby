package application_test

import (
	"context"
	"errors"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	aliceID   = "11111111-1111-4111-8111-111111111111"
	bobID     = "22222222-2222-4222-8222-222222222222"
	fridayID  = "33333333-3333-4333-8333-333333333333"
	newID     = "44444444-4444-4444-8444-444444444444"
	emptyID   = "55555555-5555-4555-8555-555555555555"
	missingID = "66666666-6666-4666-8666-666666666666"
)

var now = time.Date(2026, 11, 2, 18, 0, 0, 0, time.UTC)

// fakeStore implements the three group ports in memory and records what the use cases asked for.
type fakeStore struct {
	listed  []domain.Group
	asked   string
	groups  map[string]domain.Group
	members map[string][]domain.Member
	err     error
	// groupErr and membersErr fail one read only, so a test can show which read Get depends on.
	groupErr   error
	membersErr error

	created     int
	createdName string
	creatorID   string
	createdAt   time.Time
}

func (f *fakeStore) ListForUser(_ context.Context, userID string) ([]domain.Group, error) {
	f.asked = userID
	return f.listed, f.err
}

func (f *fakeStore) Create(_ context.Context, name, creatorID string, joinedAt time.Time) (domain.Group, error) {
	f.created++
	f.createdName, f.creatorID, f.createdAt = name, creatorID, joinedAt
	return domain.Group{ID: newID, Name: name}, f.err
}

func (f *fakeStore) Membership(_ context.Context, groupID, userID string) (domain.Member, bool, error) {
	for _, member := range f.members[groupID] {
		if member.UserID == userID {
			return member, true, f.err
		}
	}
	return domain.Member{}, false, f.err
}

func (f *fakeStore) Group(_ context.Context, groupID string) (domain.Group, error) {
	group, ok := f.groups[groupID]
	if !ok {
		return domain.Group{}, domain.ErrGroupNotFound
	}
	return group, f.groupErr
}

func (f *fakeStore) Members(_ context.Context, groupID string) ([]domain.Member, error) {
	return slices.Clone(f.members[groupID]), f.membersErr
}

// fakeDirectory answers names from a map. It counts the calls, so a test can show that none was made.
type fakeDirectory struct {
	names map[string]string
	err   error
	calls int
}

func (f *fakeDirectory) DisplayNames(_ context.Context, _ []string) (map[string]string, error) {
	f.calls++
	return f.names, f.err
}

type fixedClock struct{ at time.Time }

func (c fixedClock) Now() time.Time { return c.at }

func newGroups(store *fakeStore, directory *fakeDirectory) *application.Groups {
	return application.NewGroups(store, store, store, directory, fixedClock{at: now})
}

func TestListMineAsksRepositoryForTheCaller(t *testing.T) {
	store := &fakeStore{listed: []domain.Group{{ID: fridayID, Name: "Friday"}}}

	got, err := newGroups(store, &fakeDirectory{}).ListMine(context.Background(), aliceID)

	if err != nil {
		t.Fatal(err)
	}
	if store.asked != aliceID {
		t.Fatalf("repository asked for %q, want %q", store.asked, aliceID)
	}
	if len(got) != 1 || got[0].Name != "Friday" {
		t.Fatalf("groups %v, want the Friday group", got)
	}
}

func TestListMineIsEmptyForUserInNoGroup(t *testing.T) {
	got, err := newGroups(&fakeStore{}, &fakeDirectory{}).ListMine(context.Background(), aliceID)

	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 0 {
		t.Fatalf("groups %v, want none", got)
	}
}

func TestListMineKeepsUnavailable(t *testing.T) {
	store := &fakeStore{err: domain.ErrUnavailable}

	_, err := newGroups(store, &fakeDirectory{}).ListMine(context.Background(), aliceID)

	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("error %v, want ErrUnavailable", err)
	}
}

// An invalid name is refused before any write, so nothing is saved (REQ-0002).
func TestCreateRefusesInvalidNameBeforeAnyWrite(t *testing.T) {
	tests := []struct {
		name string
		raw  string
	}{
		{name: "empty", raw: ""},
		{name: "only spaces", raw: "   "},
		{name: "fifty-one characters", raw: strings.Repeat("x", 51)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := &fakeStore{}

			_, err := newGroups(store, &fakeDirectory{}).Create(context.Background(), aliceID, tc.raw)

			if !errors.Is(err, domain.ErrInvalidGroupName) {
				t.Fatalf("error %v, want ErrInvalidGroupName", err)
			}
			if store.created != 0 {
				t.Fatalf("repository created %d groups for an invalid name", store.created)
			}
		})
	}
}

func TestCreateStoresTrimmedNameForCreatorAtClockTime(t *testing.T) {
	store := &fakeStore{}

	group, err := newGroups(store, &fakeDirectory{}).Create(context.Background(), aliceID, "  Friday  ")

	if err != nil {
		t.Fatal(err)
	}
	if store.createdName != "Friday" || store.creatorID != aliceID || !store.createdAt.Equal(now) {
		t.Fatalf("created %q for %q at %v, want Friday for alice at the clock time", store.createdName, store.creatorID, store.createdAt)
	}
	if group.ID != newID || group.Name != "Friday" {
		t.Fatalf("group %+v, want the stored group", group)
	}
}

func TestCreateKeepsUnavailable(t *testing.T) {
	store := &fakeStore{err: domain.ErrUnavailable}

	_, err := newGroups(store, &fakeDirectory{}).Create(context.Background(), aliceID, "Friday")

	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("error %v, want ErrUnavailable", err)
	}
}

// A non-member and an unknown group get the same error, and auth is never asked for names (ADR 0004 rule 2).
func TestGetDeniesNonMemberAndUnknownGroupWithoutNameLookup(t *testing.T) {
	tests := []struct {
		name    string
		groupID string
	}{
		{name: "non-member of an existing group", groupID: fridayID},
		{name: "unknown group", groupID: missingID},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := &fakeStore{
				groups:  map[string]domain.Group{fridayID: {ID: fridayID, Name: "Friday"}},
				members: map[string][]domain.Member{fridayID: {{UserID: aliceID, Role: domain.RoleAdmin}}},
			}
			directory := &fakeDirectory{}

			_, _, err := newGroups(store, directory).Get(context.Background(), bobID, tc.groupID)

			if !errors.Is(err, domain.ErrGroupNotFound) {
				t.Fatalf("error %v, want ErrGroupNotFound", err)
			}
			if directory.calls != 0 {
				t.Fatalf("auth asked %d times for a non-member", directory.calls)
			}
		})
	}
}

// A group deleted between the membership check and the group read is the same not found, and auth is not asked.
func TestGetGivesNotFoundWhenMemberButGroupIsGone(t *testing.T) {
	store := &fakeStore{members: map[string][]domain.Member{fridayID: {{UserID: aliceID, Role: domain.RoleAdmin}}}}
	directory := &fakeDirectory{}

	_, _, err := newGroups(store, directory).Get(context.Background(), aliceID, fridayID)

	if !errors.Is(err, domain.ErrGroupNotFound) {
		t.Fatalf("error %v, want ErrGroupNotFound", err)
	}
	if directory.calls != 0 {
		t.Fatalf("auth asked %d times for a group that is gone", directory.calls)
	}
}

func TestGetReturnsNameAndMembersWithDisplayNameAndRole(t *testing.T) {
	store := &fakeStore{
		groups: map[string]domain.Group{fridayID: {ID: fridayID, Name: "Friday"}},
		members: map[string][]domain.Member{fridayID: {
			{UserID: aliceID, Role: domain.RoleAdmin},
			{UserID: bobID, Role: domain.RoleMember},
		}},
	}
	directory := &fakeDirectory{names: map[string]string{aliceID: "Alex", bobID: "Bo"}}

	group, members, err := newGroups(store, directory).Get(context.Background(), bobID, fridayID)

	if err != nil {
		t.Fatal(err)
	}
	if group.Name != "Friday" {
		t.Fatalf("group name %q, want Friday", group.Name)
	}
	want := []domain.Member{
		{UserID: aliceID, DisplayName: "Alex", Role: domain.RoleAdmin},
		{UserID: bobID, DisplayName: "Bo", Role: domain.RoleMember},
	}
	if !reflect.DeepEqual(members, want) {
		t.Fatalf("members %+v, want %+v", members, want)
	}
}

func TestGetKeepsUnavailableFromDirectoryAndDatabase(t *testing.T) {
	tests := []struct {
		name      string
		store     *fakeStore
		directory *fakeDirectory
	}{
		{
			name:      "database does not answer",
			store:     &fakeStore{err: domain.ErrUnavailable},
			directory: &fakeDirectory{},
		},
		{
			name: "auth does not answer",
			store: &fakeStore{
				groups:  map[string]domain.Group{fridayID: {ID: fridayID, Name: "Friday"}},
				members: map[string][]domain.Member{fridayID: {{UserID: aliceID, Role: domain.RoleAdmin}}},
			},
			directory: &fakeDirectory{err: domain.ErrUnavailable},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, _, err := newGroups(tc.store, tc.directory).Get(context.Background(), aliceID, fridayID)

			if !errors.Is(err, domain.ErrUnavailable) {
				t.Fatalf("error %v, want ErrUnavailable", err)
			}
		})
	}
}

// A failed read stops Get before auth is asked, and the error stays unavailable (ADR 0006).
func TestGetKeepsUnavailableWhenOneReadFails(t *testing.T) {
	groups := map[string]domain.Group{fridayID: {ID: fridayID, Name: "Friday"}}
	members := map[string][]domain.Member{fridayID: {{UserID: aliceID, Role: domain.RoleAdmin}}}
	tests := []struct {
		name  string
		store *fakeStore
	}{
		{name: "only the group read fails", store: &fakeStore{groups: groups, members: members, groupErr: domain.ErrUnavailable}},
		{name: "only the members read fails", store: &fakeStore{groups: groups, members: members, membersErr: domain.ErrUnavailable}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			directory := &fakeDirectory{}

			_, _, err := newGroups(tc.store, directory).Get(context.Background(), aliceID, fridayID)

			if !errors.Is(err, domain.ErrUnavailable) {
				t.Fatalf("error %v, want ErrUnavailable", err)
			}
			if directory.calls != 0 {
				t.Fatalf("auth asked %d times after a failed read", directory.calls)
			}
		})
	}
}
