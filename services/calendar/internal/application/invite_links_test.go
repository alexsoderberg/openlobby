package application_test

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	strangerID        = "77777777-7777-4777-8777-777777777777"
	newLinkID         = "88888888-8888-4888-8888-888888888888"
	issuedToken       = "issued-token"
	aboveLimitMaxUses = 11
)

// linkStore adds the invite link operations to the in-memory group store. It records the cleanup and the insert, so a
// test can show that a refused request wrote nothing.
type linkStore struct {
	*fakeStore
	links     []domain.InviteLink
	inserted  []domain.InviteLink
	cleaned   int
	cleanedAt time.Time
	// tokens is what the unlocked lookup by token sees; links is what the locked re-read and the lists see.
	tokens  map[string]application.LinkLookup
	added   []string
	addedAt time.Time
	counted []string
	// useErr is returned by IncrementUse, so a test can show that a failed write is not swallowed.
	useErr  error
	deleted []string
}

// FindLinkByToken answers from tokens, so a test can show a lookup that is stale under the lock.
func (s *linkStore) FindLinkByToken(_ context.Context, token string) (application.LinkLookup, bool, error) {
	lookup, found := s.tokens[token]
	return lookup, found, nil
}

func (s *linkStore) LinkByID(_ context.Context, _, linkID string) (domain.InviteLink, bool, error) {
	for _, link := range s.links {
		if link.ID == linkID {
			return link, true, nil
		}
	}
	return domain.InviteLink{}, false, nil
}

func (s *linkStore) AddMember(_ context.Context, _, userID string, joinedAt time.Time) error {
	s.added = append(s.added, userID)
	s.addedAt = joinedAt
	return nil
}

func (s *linkStore) IncrementUse(_ context.Context, _, linkID string) error {
	s.counted = append(s.counted, linkID)
	return s.useErr
}

func newLinkStore() *linkStore {
	return &linkStore{fakeStore: &fakeStore{
		groups:  map[string]domain.Group{fridayID: {ID: fridayID, Name: "Friday"}},
		members: map[string][]domain.Member{fridayID: {{UserID: aliceID, Role: domain.RoleAdmin}, {UserID: bobID, Role: domain.RoleMember}}},
	}}
}

// WithLockedGroup gives the operations of the transaction, as the adapter does, and refuses a missing group.
func (s *linkStore) WithLockedGroup(_ context.Context, groupID string, fn func(application.GroupTx) error) error {
	if _, ok := s.groups[groupID]; !ok {
		return domain.ErrGroupNotFound
	}
	return fn(s)
}

func (s *linkStore) DeleteInactiveInviteLinks(_ context.Context, _ string, now time.Time) error {
	s.cleaned++
	s.cleanedAt = now
	return nil
}

func (s *linkStore) InsertInviteLink(_ context.Context, link domain.InviteLink) (domain.InviteLink, error) {
	link.ID = newLinkID
	s.inserted = append(s.inserted, link)
	return link, nil
}

func (s *linkStore) AllLinks(_ context.Context, _ string) ([]domain.InviteLink, error) {
	return slices.Clone(s.links), nil
}

func (s *linkStore) LinksCreatedBy(_ context.Context, _, userID string) ([]domain.InviteLink, error) {
	var own []domain.InviteLink
	for _, link := range s.links {
		if link.CreatedByUserID == userID {
			own = append(own, link)
		}
	}
	return own, nil
}

type fixedTokens struct{}

func (fixedTokens) NewToken() (string, error) { return issuedToken, nil }

func newInviteLinks(store *linkStore) *application.InviteLinks {
	return application.NewInviteLinks(store, store, store, fixedTokens{}, fixedClock{at: now})
}

func TestCreateStoresLinkWithDefaultMaxUsesAndTwoHourLifetime(t *testing.T) {
	store := newLinkStore()

	link, err := newInviteLinks(store).Create(context.Background(), fridayID, bobID, nil)

	if err != nil {
		t.Fatal(err)
	}
	if link.Token != issuedToken || link.CreatedByUserID != bobID || link.ID != newLinkID {
		t.Fatalf("link %+v, want the issued token, Bob as creator and the stored ID", link)
	}
	if link.MaxUses != domain.InviteLinkDefaultMaxUses || link.UseCount != 0 {
		t.Fatalf("max uses %d and use count %d, want the default and 0", link.MaxUses, link.UseCount)
	}
	if !link.CreatedAt.Equal(now) || !link.ExpiresAt.Equal(now.Add(domain.InviteLinkLifetime)) {
		t.Fatalf("created %v and expires %v, want now and ten minutes later", link.CreatedAt, link.ExpiresAt)
	}
	if store.cleaned != 1 || !store.cleanedAt.Equal(now) {
		t.Fatalf("cleanup ran %d times at %v, want once at now", store.cleaned, store.cleanedAt)
	}
}

// A refused request writes nothing: no insert and no cleanup (ADR 0007, order of the checks).
func TestCreateRefusesBeforeAnyWrite(t *testing.T) {
	tests := []struct {
		name    string
		groupID string
		caller  string
		maxUses *int
		want    error
	}{
		{name: "non-member gets group not found", groupID: fridayID, caller: strangerID, want: domain.ErrGroupNotFound},
		{name: "missing group gets group not found", groupID: missingID, caller: bobID, want: domain.ErrGroupNotFound},
		{name: "non-member is refused before max uses", groupID: fridayID, caller: strangerID, maxUses: intPtr(aboveLimitMaxUses), want: domain.ErrGroupNotFound},
		{name: "member with max uses above limit", groupID: fridayID, caller: bobID, maxUses: intPtr(aboveLimitMaxUses), want: domain.ErrInvalidMaxUses},
		{name: "member with max uses zero", groupID: fridayID, caller: bobID, maxUses: intPtr(0), want: domain.ErrInvalidMaxUses},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := newLinkStore()

			_, err := newInviteLinks(store).Create(context.Background(), tc.groupID, tc.caller, tc.maxUses)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if len(store.inserted) != 0 || store.cleaned != 0 {
				t.Fatalf("inserted %d links and cleaned %d times, want no write", len(store.inserted), store.cleaned)
			}
		})
	}
}

// Active links have an expiry after now and uses left. Expiry at exactly now is not active (ADR 0007).
var (
	liveUntil     = now.Add(time.Hour)
	linksOfFriday = []domain.InviteLink{
		{ID: "bob-live", CreatedByUserID: bobID, ExpiresAt: liveUntil, MaxUses: 10},
		{ID: "alice-live", CreatedByUserID: aliceID, ExpiresAt: liveUntil, MaxUses: 10},
		{ID: "alice-expired", CreatedByUserID: aliceID, ExpiresAt: now, MaxUses: 10},
		{ID: "bob-used-up", CreatedByUserID: bobID, ExpiresAt: liveUntil, UseCount: 10, MaxUses: 10},
	}
)

func TestListShowsMemberOwnActiveLinksAndAdminAllActiveLinks(t *testing.T) {
	tests := []struct {
		name   string
		caller string
		want   []string
	}{
		{name: "member sees only their own active link", caller: bobID, want: []string{"bob-live"}},
		{name: "admin sees all active links of the group", caller: aliceID, want: []string{"bob-live", "alice-live"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := newLinkStore()
			store.links = linksOfFriday

			links, err := newInviteLinks(store).List(context.Background(), fridayID, tc.caller)

			if err != nil {
				t.Fatal(err)
			}
			if got := idsOf(links); !slices.Equal(got, tc.want) {
				t.Fatalf("links %v, want %v", got, tc.want)
			}
		})
	}
}

func TestListRefusesNonMemberAsGroupNotFound(t *testing.T) {
	store := newLinkStore()
	store.links = linksOfFriday

	_, err := newInviteLinks(store).List(context.Background(), fridayID, strangerID)

	if !errors.Is(err, domain.ErrGroupNotFound) {
		t.Fatalf("error %v, want ErrGroupNotFound", err)
	}
}

func idsOf(links []domain.InviteLink) []string {
	ids := make([]string, len(links))
	for i, link := range links {
		ids[i] = link.ID
	}
	return ids
}

func intPtr(value int) *int { return &value }
