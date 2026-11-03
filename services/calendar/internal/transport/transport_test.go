package transport_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	"openlobby/services/calendar/internal/transport"
)

const (
	alexID    = "5f0c2e1a-9b7d-4c1e-8a3f-1d2e3f4a5b6c"
	otherID   = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
	fridayID  = "11111111-1111-4111-8111-111111111111"
	createdID = "44444444-4444-4444-8444-444444444444"
	missingID = "66666666-6666-4666-8666-666666666666"
	// overLimitBytes is one byte over the 16 KiB body limit of ADR 0001.
	overLimitBytes = 16<<10 + 1
)

var clockNow = time.Date(2026, 11, 2, 18, 0, 0, 0, time.UTC)

// memoryGroups keeps groups and memberships in memory, so the handlers see the same rules as with the database.
// err is returned by every call, as if the database did not answer.
type memoryGroups struct {
	groups  map[string]domain.Group
	members map[string][]domain.Member
	links   map[string][]domain.InviteLink
	games   []domain.Game
	err     error
	calls   int
	created int
}

func (m *memoryGroups) ListForUser(_ context.Context, userID string) ([]domain.Group, error) {
	m.calls++
	var groups []domain.Group
	for groupID, members := range m.members {
		for _, member := range members {
			if member.UserID == userID {
				groups = append(groups, m.groups[groupID])
			}
		}
	}
	return groups, m.err
}

func (m *memoryGroups) Create(_ context.Context, name, creatorID string, _ time.Time) (domain.Group, error) {
	m.calls++
	m.created++
	group := domain.Group{ID: createdID, Name: name}
	if m.groups == nil {
		m.groups, m.members = map[string]domain.Group{}, map[string][]domain.Member{}
	}
	m.groups[createdID] = group
	m.members[createdID] = []domain.Member{{UserID: creatorID, Role: domain.RoleAdmin}}
	return group, m.err
}

func (m *memoryGroups) Membership(_ context.Context, groupID, userID string) (domain.Member, bool, error) {
	m.calls++
	for _, member := range m.members[groupID] {
		if member.UserID == userID {
			return member, true, m.err
		}
	}
	return domain.Member{}, false, m.err
}

func (m *memoryGroups) Group(_ context.Context, groupID string) (domain.Group, error) {
	m.calls++
	group, ok := m.groups[groupID]
	if !ok {
		return domain.Group{}, domain.ErrGroupNotFound
	}
	return group, m.err
}

func (m *memoryGroups) ListForGroup(_ context.Context, _ string) ([]application.GameUsage, error) {
	m.calls++
	usages := make([]application.GameUsage, 0, len(m.games))
	for _, game := range m.games {
		usages = append(usages, application.GameUsage{Game: game})
	}
	return usages, m.err
}

func (m *memoryGroups) Members(_ context.Context, groupID string) ([]domain.Member, error) {
	m.calls++
	return append([]domain.Member(nil), m.members[groupID]...), m.err
}

// fakeDirectory answers display names and counts the lookups, so a test can show that auth was not asked.
type fakeDirectory struct {
	names map[string]string
	err   error
	calls int
}

func (f *fakeDirectory) DisplayNames(_ context.Context, _ []string) (map[string]string, error) {
	f.calls++
	return f.names, f.err
}

type fixedClock struct{}

func (fixedClock) Now() time.Time { return clockNow }

// fridayStore is a store with the group Friday, whose admin is alex and whose member is other.
func fridayStore() *memoryGroups {
	return &memoryGroups{
		groups: map[string]domain.Group{fridayID: {ID: fridayID, Name: "Friday"}},
		links:  map[string][]domain.InviteLink{},
		members: map[string][]domain.Member{fridayID: {
			{UserID: alexID, Role: domain.RoleAdmin},
			{UserID: otherID, Role: domain.RoleMember},
		}},
	}
}

// fridayDirectory names the members of Friday. Each test gets its own, so the call counts do not mix.
func fridayDirectory() *fakeDirectory {
	return &fakeDirectory{names: map[string]string{alexID: "Alex", otherID: "Bo"}}
}

func newRouter(store *memoryGroups, directory *fakeDirectory) http.Handler {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ready := func(context.Context) error { return store.err }
	groups := application.NewGroups(store, store, store, directory, fixedClock{})
	games := application.NewGames(store, store)
	invites := application.NewInviteLinks(store, store, store, fixedTokens{}, fixedClock{})
	return transport.NewRouter(groups, invites, games, ready, logger)
}

func call(router http.Handler, method, target string, headers map[string]string, body string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, target, strings.NewReader(body))
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func asUser(userID string) map[string]string {
	return map[string]string{"X-User-Id": userID}
}

// assertErrorEnvelope checks the exact shape of ADR 0001: a code and a request ID, and no other field.
func assertErrorEnvelope(t *testing.T, response *httptest.ResponseRecorder, wantStatus int, wantCode string) {
	t.Helper()
	if response.Code != wantStatus {
		t.Fatalf("status %d, want %d; body %q", response.Code, wantStatus, response.Body.String())
	}
	var body map[string]map[string]string
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
	envelope := body["error"]
	if len(body) != 1 || len(envelope) != 2 || envelope["code"] != wantCode || envelope["requestId"] == "" {
		t.Fatalf("envelope %q, want code %q and a requestId", response.Body.String(), wantCode)
	}
	if envelope["requestId"] != response.Header().Get("X-Request-Id") {
		t.Fatalf("requestId %q differs from the X-Request-Id header", envelope["requestId"])
	}
}

// errorWithoutRequestID decodes an error body and drops the request ID, to compare two error bodies.
func errorWithoutRequestID(t *testing.T, response *httptest.ResponseRecorder) map[string]map[string]any {
	t.Helper()
	var body map[string]map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
	delete(body["error"], "requestId")
	return body
}

func TestListGroupsIsEmptyForUserInNoGroup(t *testing.T) {
	response := call(newRouter(&memoryGroups{}, &fakeDirectory{}), http.MethodGet, "/api/groups", asUser(alexID), "")

	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "[]" {
		t.Fatalf("status %d, body %q; want 200 and an empty list", response.Code, response.Body.String())
	}
}

func TestListGroupsShowsOnlyTheCallersGroups(t *testing.T) {
	router := newRouter(fridayStore(), fridayDirectory())

	mine := call(router, http.MethodGet, "/api/groups", asUser(alexID), "")
	var list []map[string]string
	if err := json.Unmarshal(mine.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode %q: %v", mine.Body.String(), err)
	}
	if mine.Code != http.StatusOK || len(list) != 1 || list[0]["id"] != fridayID || list[0]["name"] != "Friday" || len(list[0]) != 2 {
		t.Fatalf("status %d, body %q; want one GroupSummary with id and name", mine.Code, mine.Body.String())
	}

	others := call(router, http.MethodGet, "/api/groups", asUser(missingID), "")
	if strings.TrimSpace(others.Body.String()) != "[]" {
		t.Fatalf("another user sees %q, want an empty list", others.Body.String())
	}
}

func TestListGroupsRefusesMissingOrInvalidIdentityBeforeTheUseCase(t *testing.T) {
	tests := []struct {
		name    string
		headers map[string]string
	}{
		{name: "missing", headers: nil},
		{name: "not a uuid", headers: asUser("alex")},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := &memoryGroups{}
			response := call(newRouter(store, &fakeDirectory{}), http.MethodGet, "/api/groups", tc.headers, "")

			assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
			if store.calls != 0 {
				t.Fatalf("repository called %d times for an unauthenticated request", store.calls)
			}
		})
	}
}

func TestListGroupsReturns503WhenDatabaseDown(t *testing.T) {
	response := call(newRouter(&memoryGroups{err: domain.ErrUnavailable}, &fakeDirectory{}), http.MethodGet, "/api/groups", asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}

func TestListGroupsReturns500WithoutDetails(t *testing.T) {
	response := call(newRouter(&memoryGroups{err: errors.New("secret detail")}, &fakeDirectory{}), http.MethodGet, "/api/groups", asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusInternalServerError, "internal_error")
	if strings.Contains(response.Body.String(), "secret detail") {
		t.Fatalf("500 body leaks the error: %q", response.Body.String())
	}
}

func TestCreateGroupReturns201AndMakesTheCallerAdmin(t *testing.T) {
	store := &memoryGroups{}
	router := newRouter(store, &fakeDirectory{names: map[string]string{alexID: "Alex"}})

	created := call(router, http.MethodPost, "/api/groups", asUser(alexID), `{"name":"  Friday  "}`)

	var summary map[string]string
	if err := json.Unmarshal(created.Body.Bytes(), &summary); err != nil {
		t.Fatalf("decode %q: %v", created.Body.String(), err)
	}
	if created.Code != http.StatusCreated || summary["id"] != createdID || summary["name"] != "Friday" || len(summary) != 2 {
		t.Fatalf("status %d, body %q; want 201 with the GroupSummary", created.Code, created.Body.String())
	}
	detail := call(router, http.MethodGet, "/api/groups/"+createdID, asUser(alexID), "")
	if !strings.Contains(detail.Body.String(), `"role":"admin"`) {
		t.Fatalf("creator is not admin: status %d, body %q", detail.Code, detail.Body.String())
	}
}

// Names are checked in the domain before any write, so an invalid name saves nothing (REQ-0002).
func TestCreateGroupRefusesInvalidNameAndSavesNothing(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "name omitted", body: `{}`},
		{name: "name null", body: `{"name":null}`},
		{name: "empty", body: `{"name":""}`},
		{name: "only spaces", body: `{"name":"   "}`},
		{name: "fifty-one characters", body: `{"name":"` + strings.Repeat("x", 51) + `"}`},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := &memoryGroups{}

			response := call(newRouter(store, &fakeDirectory{}), http.MethodPost, "/api/groups", asUser(alexID), tc.body)

			assertErrorEnvelope(t, response, http.StatusBadRequest, "invalid_group_name")
			if store.created != 0 {
				t.Fatalf("%d groups saved for an invalid name", store.created)
			}
		})
	}
}

// A wrong JSON type, invalid JSON and a body over 16 KiB are shape errors (invalid_request), not name errors.
func TestCreateGroupRefusesMalformedBody(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "name is a number", body: `{"name":5}`},
		{name: "invalid JSON", body: `{"name":`},
		{name: "empty body", body: ``},
		{name: "body over 16 KiB", body: `{"name":"` + strings.Repeat("x", overLimitBytes) + `"}`},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := &memoryGroups{}

			response := call(newRouter(store, &fakeDirectory{}), http.MethodPost, "/api/groups", asUser(alexID), tc.body)

			assertErrorEnvelope(t, response, http.StatusBadRequest, "invalid_request")
			if store.created != 0 {
				t.Fatalf("%d groups saved for a malformed body", store.created)
			}
		})
	}
}

func TestCreateGroupRefusesMissingIdentityBeforeTheUseCase(t *testing.T) {
	store := &memoryGroups{}

	response := call(newRouter(store, &fakeDirectory{}), http.MethodPost, "/api/groups", nil, `{"name":"Friday"}`)

	assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
	if store.calls != 0 {
		t.Fatalf("repository called %d times for an unauthenticated request", store.calls)
	}
}

func TestCreateGroupAnswers503AndNoDetailOnFailure(t *testing.T) {
	unavailable := call(newRouter(&memoryGroups{err: domain.ErrUnavailable}, &fakeDirectory{}), http.MethodPost, "/api/groups", asUser(alexID), `{"name":"Friday"}`)
	assertErrorEnvelope(t, unavailable, http.StatusServiceUnavailable, "service_unavailable")

	internal := call(newRouter(&memoryGroups{err: errors.New("secret detail")}, &fakeDirectory{}), http.MethodPost, "/api/groups", asUser(alexID), `{"name":"Friday"}`)
	assertErrorEnvelope(t, internal, http.StatusInternalServerError, "internal_error")
	if strings.Contains(internal.Body.String(), "secret detail") {
		t.Fatalf("500 body leaks the error: %q", internal.Body.String())
	}
}

func TestGetGroupReturnsNameAndMembersWithNamesAndRoles(t *testing.T) {
	response := call(newRouter(fridayStore(), fridayDirectory()), http.MethodGet, "/api/groups/"+fridayID, asUser(otherID), "")

	var group struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Members []struct {
			UserID      string `json:"userId"`
			DisplayName string `json:"displayName"`
			Role        string `json:"role"`
		} `json:"members"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &group); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
	if response.Code != http.StatusOK || group.ID != fridayID || group.Name != "Friday" {
		t.Fatalf("status %d, body %q; want 200 with id and name", response.Code, response.Body.String())
	}
	got := make([]string, 0, len(group.Members))
	for _, member := range group.Members {
		got = append(got, member.UserID+" "+member.DisplayName+" "+member.Role)
	}
	want := []string{alexID + " Alex admin", otherID + " Bo member"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("members %v, want %v", got, want)
	}
}

// A non-member and an unknown group get the same 404 with no lookup of names (ADR 0004 rule 2).
func TestGetGroupGivesTheSame404ForNonMemberAndUnknownGroup(t *testing.T) {
	directory := &fakeDirectory{}
	router := newRouter(fridayStore(), directory)

	nonMember := call(router, http.MethodGet, "/api/groups/"+fridayID, asUser(missingID), "")
	unknown := call(router, http.MethodGet, "/api/groups/"+missingID, asUser(alexID), "")

	assertErrorEnvelope(t, nonMember, http.StatusNotFound, "group_not_found")
	assertErrorEnvelope(t, unknown, http.StatusNotFound, "group_not_found")
	if !reflect.DeepEqual(errorWithoutRequestID(t, nonMember), errorWithoutRequestID(t, unknown)) {
		t.Fatalf("bodies differ: %q and %q", nonMember.Body.String(), unknown.Body.String())
	}
	if directory.calls != 0 {
		t.Fatalf("auth asked %d times for a request without membership", directory.calls)
	}
}

// A group that is gone after the membership check gives the same 404 body as a non-member (ADR 0004 amendment 2026-11-02).
func TestGetGroupGone404EqualsNonMember404(t *testing.T) {
	gone := fridayStore()
	delete(gone.groups, fridayID)
	directory := &fakeDirectory{}

	goneResponse := call(newRouter(gone, directory), http.MethodGet, "/api/groups/"+fridayID, asUser(alexID), "")
	nonMember := call(newRouter(fridayStore(), directory), http.MethodGet, "/api/groups/"+fridayID, asUser(missingID), "")

	assertErrorEnvelope(t, goneResponse, http.StatusNotFound, "group_not_found")
	if !reflect.DeepEqual(errorWithoutRequestID(t, goneResponse), errorWithoutRequestID(t, nonMember)) {
		t.Fatalf("bodies differ: %q and %q", goneResponse.Body.String(), nonMember.Body.String())
	}
	if directory.calls != 0 {
		t.Fatalf("auth asked %d times for a group that is gone", directory.calls)
	}
}

func TestGetGroupGives404ForInvalidGroupID(t *testing.T) {
	store := fridayStore()

	response := call(newRouter(store, &fakeDirectory{}), http.MethodGet, "/api/groups/not-a-uuid", asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusNotFound, "group_not_found")
	if store.calls != 0 {
		t.Fatalf("repository called %d times for an invalid group ID", store.calls)
	}
}

func TestGetGroupAnswers503WhenAuthOrDatabaseDoesNotAnswer(t *testing.T) {
	authDown := call(newRouter(fridayStore(), &fakeDirectory{err: domain.ErrUnavailable}), http.MethodGet, "/api/groups/"+fridayID, asUser(alexID), "")
	assertErrorEnvelope(t, authDown, http.StatusServiceUnavailable, "service_unavailable")

	databaseDown := call(newRouter(&memoryGroups{err: domain.ErrUnavailable}, &fakeDirectory{}), http.MethodGet, "/api/groups/"+fridayID, asUser(alexID), "")
	assertErrorEnvelope(t, databaseDown, http.StatusServiceUnavailable, "service_unavailable")
}

func TestGetGroupRefusesMissingIdentity(t *testing.T) {
	store := fridayStore()

	response := call(newRouter(store, fridayDirectory()), http.MethodGet, "/api/groups/"+fridayID, nil, "")

	assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
	if store.calls != 0 {
		t.Fatalf("repository called %d times for an unauthenticated request", store.calls)
	}
}

func TestHealthzAndReadyz(t *testing.T) {
	healthy := newRouter(&memoryGroups{}, &fakeDirectory{})
	if response := call(healthy, http.MethodGet, "/healthz", nil, ""); response.Code != http.StatusOK {
		t.Fatalf("healthz status %d, want 200", response.Code)
	}
	if response := call(healthy, http.MethodGet, "/readyz", nil, ""); response.Code != http.StatusOK {
		t.Fatalf("readyz status %d, want 200", response.Code)
	}

	down := newRouter(&memoryGroups{err: domain.ErrUnavailable}, &fakeDirectory{})
	if response := call(down, http.MethodGet, "/readyz", nil, ""); response.Code != http.StatusServiceUnavailable {
		t.Fatalf("readyz status %d with the database down, want 503", response.Code)
	}
}

// Operations of later requirements are in the contract but not built. They answer 500 internal_error, not a panic.
func TestUnbuiltOperationAnswers500InternalError(t *testing.T) {
	response := call(newRouter(fridayStore(), fridayDirectory()), http.MethodGet, "/api/games", asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusInternalServerError, "internal_error")
}

// A duplicate X-Request-Id must not refuse the request: the correlation ID is replaced, not rejected (ADR 0001).
func TestListGroupsAcceptsDuplicateRequestID(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/api/groups", nil)
	request.Header.Set("X-User-Id", alexID)
	request.Header.Add("X-Request-Id", "first")
	request.Header.Add("X-Request-Id", "second")
	response := httptest.NewRecorder()

	newRouter(&memoryGroups{}, &fakeDirectory{}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body %q", response.Code, response.Body.String())
	}
}
