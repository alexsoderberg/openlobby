package application_test

import (
	"cmp"
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	chessID  = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
	lobbyID  = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"
	newLobby = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1"
)

// lobbyStore is the lobby repository in memory. Like the database it keeps writes only when the locked function
// succeeds: a failed function leaves nothing behind.
type lobbyStore struct {
	*fakeStore
	lobbies map[string]domain.Lobby // by ID
	// insertErr fails InsertLobby, to show that nothing is committed.
	insertErr error
	inserted  []domain.Lobby
	// players lists the player IDs of a lobby in join order.
	players map[string][]string
}

func (s *lobbyStore) Upcoming(_ context.Context, groupID, callerID string, at time.Time) ([]domain.Lobby, error) {
	var upcoming []domain.Lobby
	for _, lobby := range s.lobbies {
		if lobby.GroupID == groupID && lobby.EndsAt.After(at) {
			upcoming = append(upcoming, lobby)
		}
	}
	slices.SortFunc(upcoming, func(a, b domain.Lobby) int {
		return cmp.Or(a.StartsAt.Compare(b.StartsAt), cmp.Compare(a.ID, b.ID))
	})
	return upcoming, s.err
}

func (s *lobbyStore) Lobby(_ context.Context, groupID, id, callerID string, at time.Time) (domain.Lobby, error) {
	lobby, ok := s.lobbies[id]
	if !ok || lobby.GroupID != groupID || !lobby.EndsAt.After(at) {
		return domain.Lobby{}, domain.ErrLobbyNotFound
	}
	return lobby, s.err
}

func (s *lobbyStore) PlayerIDs(_ context.Context, id string) ([]string, error) {
	return s.players[id], s.err
}

func newLobbyStore() *lobbyStore {
	return &lobbyStore{
		fakeStore: &fakeStore{
			groups:  map[string]domain.Group{fridayID: {ID: fridayID, Name: "Friday"}},
			members: map[string][]domain.Member{fridayID: {{UserID: aliceID, Role: domain.RoleAdmin}, {UserID: bobID, Role: domain.RoleMember}}},
		},
		lobbies: map[string]domain.Lobby{lobbyID: {ID: lobbyID, GroupID: fridayID, CreatedByUserID: bobID}},
	}
}

func (s *lobbyStore) WithLockedGroup(_ context.Context, groupID string, fn func(application.LobbyTx) error) error {
	if _, ok := s.groups[groupID]; !ok {
		return domain.ErrGroupNotFound
	}
	staged := &lobbyTx{lobbyStore: s, lobbies: map[string]domain.Lobby{}}
	for id, lobby := range s.lobbies {
		staged.lobbies[id] = lobby
	}
	if err := fn(staged); err != nil {
		return err
	}
	s.lobbies = staged.lobbies
	return nil
}

type lobbyTx struct {
	*lobbyStore
	lobbies map[string]domain.Lobby
}

func (t *lobbyTx) InsertLobby(_ context.Context, lobby domain.Lobby) (domain.Lobby, error) {
	if t.insertErr != nil {
		return domain.Lobby{}, t.insertErr
	}
	lobby.ID = newLobby
	t.lobbies[lobby.ID] = lobby
	t.inserted = append(t.inserted, lobby)
	return lobby, nil
}

func (t *lobbyTx) CreatorOf(_ context.Context, groupID, id string) (string, bool, error) {
	lobby, ok := t.lobbies[id]
	if !ok || lobby.GroupID != groupID {
		return "", false, nil
	}
	return lobby.CreatedByUserID, true, nil
}

func (t *lobbyTx) JoinState(_ context.Context, groupID, id, userID string) (domain.JoinState, bool, error) {
	lobby, ok := t.lobbies[id]
	if !ok || lobby.GroupID != groupID {
		return domain.JoinState{}, false, nil
	}
	return domain.JoinState{EndsAt: lobby.EndsAt, MaxPlayers: lobby.MaxPlayers, PlayerCount: len(t.players[id]),
		IsPlayer: slices.Contains(t.players[id], userID)}, true, nil
}

func (t *lobbyTx) AddPlayer(_ context.Context, id, userID string, _ time.Time) error {
	t.players[id] = append(t.players[id], userID)
	return nil
}

func (t *lobbyTx) RemovePlayer(_ context.Context, id, userID string) error {
	t.players[id] = slices.DeleteFunc(t.players[id], func(p string) bool { return p == userID })
	return nil
}

func (t *lobbyTx) DeleteLobby(_ context.Context, _, id string) error {
	delete(t.lobbies, id)
	return nil
}

func (c *fakeCatalog) Find(_ context.Context, id string) (domain.Game, error) {
	c.findCalls++
	for _, game := range c.listed {
		if game.ID == id {
			return game, c.err
		}
	}
	return domain.Game{}, application.ErrGameNotFound
}

func newLobbies(store *lobbyStore, catalog *fakeCatalog) *application.Lobbies {
	return newLobbiesWithNames(store, catalog, &fakeDirectory{})
}

func newLobbiesWithNames(store *lobbyStore, catalog *fakeCatalog, names *fakeDirectory) *application.Lobbies {
	return application.NewLobbies(store, store, catalog, names, fixedClock{at: now})
}

func chessCatalog() *fakeCatalog {
	return &fakeCatalog{listed: []domain.Game{{ID: chessID, Name: "Chess"}}}
}

func strPtr(value string) *string { return &value }

func createRequest(creatorID string) domain.NewLobbyRequest {
	return domain.NewLobbyRequest{
		GroupID:   fridayID,
		CreatorID: creatorID,
		StartsAt:  now.Add(time.Hour),
		EndsAt:    now.Add(3 * time.Hour),
		GameID:    strPtr(chessID),
	}
}

func TestCreateLobbySavesLobbyForMemberWithGameNameCopied(t *testing.T) {
	store := newLobbyStore()

	lobby, err := newLobbies(store, chessCatalog()).Create(context.Background(), createRequest(bobID))

	if err != nil {
		t.Fatal(err)
	}
	if lobby.ID != newLobby || lobby.GameName != "Chess" || lobby.CreatedByUserID != bobID || lobby.PlayerCount != 1 {
		t.Fatalf("lobby %+v, want the stored ID, game name Chess, Bob as creator and one player", lobby)
	}
	if !lobby.CreatedAt.Equal(now) {
		t.Fatalf("created at %v, want the injected clock %v", lobby.CreatedAt, now)
	}
	if len(store.inserted) != 1 {
		t.Fatalf("%d lobbies stored, want 1", len(store.inserted))
	}
}

// Membership is checked before any lobby rule, so a non-member never learns whether the request was valid.
func TestCreateLobbyRefusesWithoutWriting(t *testing.T) {
	tests := []struct {
		name   string
		change func(*domain.NewLobbyRequest)
		want   error
	}{
		{name: "non-member", change: func(r *domain.NewLobbyRequest) { r.CreatorID = strangerID }, want: domain.ErrGroupNotFound},
		{name: "non-member with a lobby in the past", change: func(r *domain.NewLobbyRequest) {
			r.CreatorID, r.StartsAt = strangerID, now.Add(-time.Hour)
		}, want: domain.ErrGroupNotFound},
		{name: "missing group", change: func(r *domain.NewLobbyRequest) { r.GroupID = missingID }, want: domain.ErrGroupNotFound},
		{name: "lobby in the past", change: func(r *domain.NewLobbyRequest) { r.StartsAt = now }, want: domain.ErrLobbyInPast},
		{name: "unknown game", change: func(r *domain.NewLobbyRequest) { r.GameID = strPtr(newLobby) }, want: domain.ErrInvalidGame},
		{name: "malformed game id", change: func(r *domain.NewLobbyRequest) { r.GameID = strPtr("not-a-uuid") }, want: domain.ErrInvalidGame},
		{name: "invalid capacity", change: func(r *domain.NewLobbyRequest) { zero := 0; r.MaxPlayers = &zero }, want: domain.ErrInvalidCapacity},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := newLobbyStore()
			request := createRequest(bobID)
			tc.change(&request)

			_, err := newLobbies(store, chessCatalog()).Create(context.Background(), request)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if len(store.inserted) != 0 || len(store.lobbies) != 1 {
				t.Fatalf("stored %d new lobbies, %d in total; want none new", len(store.inserted), len(store.lobbies))
			}
		})
	}
}

func TestCreateLobbyWithCustomNameDoesNotAskTheGameList(t *testing.T) {
	catalog := chessCatalog()
	request := createRequest(bobID)
	request.GameID, request.CustomGameName = nil, strPtr(" Go ")

	lobby, err := newLobbies(newLobbyStore(), catalog).Create(context.Background(), request)

	if err != nil || lobby.GameName != "Go" || lobby.GameID != nil {
		t.Fatalf("lobby %+v, error %v; want custom name Go and no game id", lobby, err)
	}
	if catalog.findCalls != 0 {
		t.Fatalf("game list asked %d times, want none", catalog.findCalls)
	}
}

func TestCreateLobbyKeepsFailuresOfThePorts(t *testing.T) {
	store := newLobbyStore()
	store.insertErr = domain.ErrUnavailable
	_, err := newLobbies(store, chessCatalog()).Create(context.Background(), createRequest(bobID))
	if !errors.Is(err, domain.ErrUnavailable) || len(store.lobbies) != 1 {
		t.Fatalf("insert error %v, lobbies %d; want ErrUnavailable and nothing stored", err, len(store.lobbies))
	}

	catalog := &fakeCatalog{listed: []domain.Game{{ID: chessID}}, err: domain.ErrUnavailable}
	_, err = newLobbies(newLobbyStore(), catalog).Create(context.Background(), createRequest(bobID))
	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("catalog error %v, want ErrUnavailable", err)
	}
}

func TestDeleteLobbyRemovesItForTheCreator(t *testing.T) {
	store := newLobbyStore()

	if err := newLobbies(store, chessCatalog()).Delete(context.Background(), fridayID, lobbyID, bobID); err != nil {
		t.Fatal(err)
	}
	if _, ok := store.lobbies[lobbyID]; ok {
		t.Fatal("lobby still exists after the creator deleted it")
	}
}

// The order is membership, the lobby in this group, then the creator (api/calendar/openapi.yaml).
func TestDeleteLobbyRefuses(t *testing.T) {
	tests := []struct {
		name    string
		groupID string
		lobbyID string
		caller  string
		want    error
	}{
		{name: "group admin who is not the creator is denied", groupID: fridayID, lobbyID: lobbyID, caller: aliceID, want: domain.ErrNotAllowed},
		{name: "non-member", groupID: fridayID, lobbyID: lobbyID, caller: strangerID, want: domain.ErrGroupNotFound},
		{name: "non-member on a missing lobby", groupID: fridayID, lobbyID: missingID, caller: strangerID, want: domain.ErrGroupNotFound},
		{name: "missing lobby", groupID: fridayID, lobbyID: missingID, caller: bobID, want: domain.ErrLobbyNotFound},
		{name: "missing group", groupID: missingID, lobbyID: lobbyID, caller: bobID, want: domain.ErrGroupNotFound},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := newLobbyStore()

			err := newLobbies(store, chessCatalog()).Delete(context.Background(), tc.groupID, tc.lobbyID, tc.caller)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if _, ok := store.lobbies[lobbyID]; !ok {
				t.Fatal("lobby was deleted by a refused call")
			}
		})
	}
}

// A lobby of another group is not found through this group, even for its creator (ADR 0006 rule 12).
func TestDeleteLobbyIgnoresLobbyOfAnotherGroup(t *testing.T) {
	store := newLobbyStore()
	store.groups[emptyID] = domain.Group{ID: emptyID}
	store.members[emptyID] = []domain.Member{{UserID: bobID, Role: domain.RoleAdmin}}

	err := newLobbies(store, chessCatalog()).Delete(context.Background(), emptyID, lobbyID, bobID)

	if !errors.Is(err, domain.ErrLobbyNotFound) {
		t.Fatalf("error %v, want ErrLobbyNotFound", err)
	}
	if _, ok := store.lobbies[lobbyID]; !ok {
		t.Fatal("lobby of another group was deleted")
	}
}

// Overlapping lobbies are both saved: there are no conflict checks in the MVP (REQ-0003).
func TestCreateLobbySavesOverlappingLobbies(t *testing.T) {
	store := newLobbyStore()
	lobbies := newLobbies(store, chessCatalog())

	for _, creator := range []string{bobID, aliceID} {
		if _, err := lobbies.Create(context.Background(), createRequest(creator)); err != nil {
			t.Fatal(err)
		}
	}

	if len(store.inserted) != 2 {
		t.Fatalf("%d lobbies stored, want both", len(store.inserted))
	}
}

// upcomingStore has three lobbies in Friday and one in another group. Only Late and Early have not ended.
func upcomingStore() *lobbyStore {
	store := newLobbyStore()
	store.groups[emptyID] = domain.Group{ID: emptyID}
	store.lobbies = map[string]domain.Lobby{
		"l3":      {ID: "l3", GroupID: fridayID, StartsAt: now.Add(2 * time.Hour), EndsAt: now.Add(4 * time.Hour), PlayerCount: 1},
		"l2":      {ID: "l2", GroupID: fridayID, StartsAt: now.Add(time.Hour), EndsAt: now.Add(2 * time.Hour), PlayerCount: 2},
		"l1":      {ID: "l1", GroupID: fridayID, StartsAt: now.Add(time.Hour), EndsAt: now.Add(3 * time.Hour), PlayerCount: 1},
		"ended":   {ID: "ended", GroupID: fridayID, StartsAt: now.Add(-2 * time.Hour), EndsAt: now},
		"started": {ID: "started", GroupID: fridayID, StartsAt: now.Add(-time.Hour), EndsAt: now.Add(time.Minute)},
		"other":   {ID: "other", GroupID: emptyID, StartsAt: now.Add(time.Hour), EndsAt: now.Add(2 * time.Hour)},
	}
	store.players = map[string][]string{"started": {bobID, aliceID}, "ended": {bobID}, "other": {bobID}}
	return store
}

// Upcoming means ends_at > now: a lobby that ended exactly now is gone, one that has started but not ended stays.
func TestUpcomingListsLobbiesNotEndedSortedByStartThenID(t *testing.T) {
	lobbies, err := newLobbies(upcomingStore(), chessCatalog()).Upcoming(context.Background(), fridayID, bobID)

	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, lobby := range lobbies {
		ids = append(ids, lobby.ID)
	}
	if want := []string{"started", "l1", "l2", "l3"}; !slices.Equal(ids, want) {
		t.Fatalf("lobbies %v, want %v", ids, want)
	}
}

func TestUpcomingRefusesAndKeepsFailures(t *testing.T) {
	for name, groupID := range map[string]string{"non-member": fridayID, "missing group": missingID} {
		t.Run(name, func(t *testing.T) {
			_, err := newLobbies(upcomingStore(), chessCatalog()).Upcoming(context.Background(), groupID, strangerID)
			if !errors.Is(err, domain.ErrGroupNotFound) {
				t.Fatalf("error %v, want ErrGroupNotFound", err)
			}
		})
	}
	store := upcomingStore()
	store.err = domain.ErrUnavailable
	if _, err := newLobbies(store, chessCatalog()).Upcoming(context.Background(), fridayID, bobID); !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("error %v, want ErrUnavailable", err)
	}
}

func TestGetReturnsLobbyWithPlayersInStoredOrderAndOneNameLookup(t *testing.T) {
	names := &fakeDirectory{names: map[string]string{bobID: "Bob", aliceID: "Alice"}}

	lobby, players, err := newLobbiesWithNames(upcomingStore(), chessCatalog(), names).Get(context.Background(), fridayID, "started", aliceID)

	if err != nil {
		t.Fatal(err)
	}
	want := []domain.Player{{UserID: bobID, DisplayName: "Bob"}, {UserID: aliceID, DisplayName: "Alice"}}
	if lobby.ID != "started" || !slices.Equal(players, want) || names.calls != 1 {
		t.Fatalf("lobby %q, players %v, name lookups %d; want started, %v and 1 lookup", lobby.ID, players, names.calls, want)
	}
}

func TestGetRefuses(t *testing.T) {
	tests := []struct {
		name    string
		groupID string
		lobbyID string
		caller  string
		want    error
	}{
		{name: "non-member", groupID: fridayID, lobbyID: "started", caller: strangerID, want: domain.ErrGroupNotFound},
		{name: "non-member on a missing lobby", groupID: fridayID, lobbyID: missingID, caller: strangerID, want: domain.ErrGroupNotFound},
		{name: "ended lobby", groupID: fridayID, lobbyID: "ended", caller: bobID, want: domain.ErrLobbyNotFound},
		{name: "missing lobby", groupID: fridayID, lobbyID: missingID, caller: bobID, want: domain.ErrLobbyNotFound},
		{name: "lobby of another group", groupID: fridayID, lobbyID: "other", caller: bobID, want: domain.ErrLobbyNotFound},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			names := &fakeDirectory{}

			_, _, err := newLobbiesWithNames(upcomingStore(), chessCatalog(), names).Get(context.Background(), tc.groupID, tc.lobbyID, tc.caller)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if names.calls != 0 {
				t.Fatalf("auth asked %d times, want none", names.calls)
			}
		})
	}
}

func TestGetFailsWhenAuthFails(t *testing.T) {
	names := &fakeDirectory{err: domain.ErrUnavailable}

	_, _, err := newLobbiesWithNames(upcomingStore(), chessCatalog(), names).Get(context.Background(), fridayID, "started", bobID)

	if !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("error %v, want ErrUnavailable", err)
	}
}

// openLobbyStore has a lobby that ends after now, with Bob as its only player, so that Alice can join.
func openLobbyStore(maxPlayers *int) *lobbyStore {
	return lobbyStoreEndingAt(maxPlayers, now.Add(time.Hour))
}

func lobbyStoreEndingAt(maxPlayers *int, endsAt time.Time) *lobbyStore {
	store := newLobbyStore()
	store.lobbies[lobbyID] = domain.Lobby{ID: lobbyID, GroupID: fridayID, CreatedByUserID: bobID, MaxPlayers: maxPlayers, EndsAt: endsAt}
	store.players = map[string][]string{lobbyID: {bobID}}
	return store
}

func TestJoinAddsTheMemberOnce(t *testing.T) {
	store := openLobbyStore(nil)
	lobbies := newLobbies(store, chessCatalog())

	for range 2 {
		if err := lobbies.Join(context.Background(), fridayID, lobbyID, aliceID); err != nil {
			t.Fatal(err)
		}
	}
	if want := []string{bobID, aliceID}; !slices.Equal(store.players[lobbyID], want) {
		t.Fatalf("players %v, want %v", store.players[lobbyID], want)
	}
}

func TestJoinRefusesWithoutWriting(t *testing.T) {
	tests := []struct {
		name    string
		store   *lobbyStore
		groupID string
		lobbyID string
		caller  string
		want    error
	}{
		{name: "non-member", store: openLobbyStore(nil), groupID: fridayID, lobbyID: lobbyID, caller: strangerID, want: domain.ErrGroupNotFound},
		{name: "non-member on a missing lobby", store: openLobbyStore(nil), groupID: fridayID, lobbyID: missingID, caller: strangerID, want: domain.ErrGroupNotFound},
		{name: "missing lobby", store: openLobbyStore(nil), groupID: fridayID, lobbyID: missingID, caller: aliceID, want: domain.ErrLobbyNotFound},
		{name: "missing group", store: openLobbyStore(nil), groupID: missingID, lobbyID: lobbyID, caller: aliceID, want: domain.ErrGroupNotFound},
		{name: "ended", store: lobbyStoreEndingAt(nil, now), groupID: fridayID, lobbyID: lobbyID, caller: aliceID, want: domain.ErrLobbyHasEnded},
		{name: "full", store: openLobbyStore(intPtr(1)), groupID: fridayID, lobbyID: lobbyID, caller: aliceID, want: domain.ErrLobbyFull},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := newLobbies(tc.store, chessCatalog()).Join(context.Background(), tc.groupID, tc.lobbyID, tc.caller)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if !slices.Equal(tc.store.players[lobbyID], []string{bobID}) {
				t.Fatalf("players %v, want only Bob", tc.store.players[lobbyID])
			}
		})
	}
}

func TestJoinByAPlayerOfAFullLobbyChangesNothing(t *testing.T) {
	store := openLobbyStore(intPtr(1))

	if err := newLobbies(store, chessCatalog()).Join(context.Background(), fridayID, lobbyID, bobID); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(store.players[lobbyID], []string{bobID}) {
		t.Fatalf("players %v, want only Bob", store.players[lobbyID])
	}
}

func TestLeaveRemovesThePlayerAlsoAfterTheEndAndIsIdempotent(t *testing.T) {
	store := lobbyStoreEndingAt(nil, now)
	lobbies := newLobbies(store, chessCatalog())

	for range 2 {
		if err := lobbies.Leave(context.Background(), fridayID, lobbyID, bobID); err != nil {
			t.Fatal(err)
		}
	}
	if err := lobbies.Leave(context.Background(), fridayID, lobbyID, aliceID); err != nil {
		t.Fatalf("a non-player leaving: %v", err)
	}
	if len(store.players[lobbyID]) != 0 {
		t.Fatalf("players %v, want none", store.players[lobbyID])
	}
}

func TestLeaveRefuses(t *testing.T) {
	tests := []struct {
		name    string
		lobbyID string
		caller  string
		want    error
	}{
		{name: "non-member", lobbyID: lobbyID, caller: strangerID, want: domain.ErrGroupNotFound},
		{name: "missing lobby", lobbyID: missingID, caller: bobID, want: domain.ErrLobbyNotFound},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := openLobbyStore(nil)

			err := newLobbies(store, chessCatalog()).Leave(context.Background(), fridayID, tc.lobbyID, tc.caller)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v, want %v", err, tc.want)
			}
			if !slices.Equal(store.players[lobbyID], []string{bobID}) {
				t.Fatalf("players %v, want Bob kept", store.players[lobbyID])
			}
		})
	}
}
