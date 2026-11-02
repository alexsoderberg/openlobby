package transport_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	"openlobby/services/calendar/internal/transport"
)

const (
	alexID   = "5f0c2e1a-9b7d-4c1e-8a3f-1d2e3f4a5b6c"
	otherID  = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
	fridayID = "11111111-1111-4111-8111-111111111111"
)

// fakeGroups keeps the groups per user, so a test can show that another user's groups are not listed.
type fakeGroups struct {
	byUser map[string][]domain.Group
	err    error
	calls  int
}

func (f *fakeGroups) ListForUser(_ context.Context, userID string) ([]domain.Group, error) {
	f.calls++
	return f.byUser[userID], f.err
}

func newRouter(repo *fakeGroups) http.Handler {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	ready := func(context.Context) error { return repo.err }
	return transport.NewRouter(application.NewGroups(repo), ready, logger)
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

func TestListGroupsIsEmptyForUserInNoGroup(t *testing.T) {
	response := call(newRouter(&fakeGroups{}), http.MethodGet, "/api/groups", asUser(alexID), "")

	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "[]" {
		t.Fatalf("status %d, body %q; want 200 and an empty list", response.Code, response.Body.String())
	}
}

func TestListGroupsShowsOnlyTheCallersGroups(t *testing.T) {
	repo := &fakeGroups{byUser: map[string][]domain.Group{alexID: {{ID: fridayID, Name: "Friday"}}}}
	router := newRouter(repo)

	mine := call(router, http.MethodGet, "/api/groups", asUser(alexID), "")
	var list []map[string]string
	if err := json.Unmarshal(mine.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode %q: %v", mine.Body.String(), err)
	}
	if mine.Code != http.StatusOK || len(list) != 1 || list[0]["id"] != fridayID || list[0]["name"] != "Friday" || len(list[0]) != 2 {
		t.Fatalf("status %d, body %q; want one GroupSummary with id and name", mine.Code, mine.Body.String())
	}

	others := call(router, http.MethodGet, "/api/groups", asUser(otherID), "")
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
			repo := &fakeGroups{}
			response := call(newRouter(repo), http.MethodGet, "/api/groups", tc.headers, "")

			assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
			if repo.calls != 0 {
				t.Fatalf("repository called %d times for an unauthenticated request", repo.calls)
			}
		})
	}
}

func TestListGroupsReturns503WhenDatabaseDown(t *testing.T) {
	response := call(newRouter(&fakeGroups{err: domain.ErrUnavailable}), http.MethodGet, "/api/groups", asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}

func TestListGroupsReturns500WithoutDetails(t *testing.T) {
	response := call(newRouter(&fakeGroups{err: errors.New("secret detail")}), http.MethodGet, "/api/groups", asUser(alexID), "")

	assertErrorEnvelope(t, response, http.StatusInternalServerError, "internal_error")
	if strings.Contains(response.Body.String(), "secret detail") {
		t.Fatalf("500 body leaks the error: %q", response.Body.String())
	}
}

// Operations of later requirements are in the contract but not built. They answer 500 internal_error, not a panic.
func TestUnbuiltOperationAnswers500InternalError(t *testing.T) {
	response := call(newRouter(&fakeGroups{}), http.MethodPost, "/api/groups", asUser(alexID), `{"name":"Friday"}`)

	assertErrorEnvelope(t, response, http.StatusInternalServerError, "internal_error")
}

func TestHealthzAndReadyz(t *testing.T) {
	healthy := newRouter(&fakeGroups{})
	if response := call(healthy, http.MethodGet, "/healthz", nil, ""); response.Code != http.StatusOK {
		t.Fatalf("healthz status %d, want 200", response.Code)
	}
	if response := call(healthy, http.MethodGet, "/readyz", nil, ""); response.Code != http.StatusOK {
		t.Fatalf("readyz status %d, want 200", response.Code)
	}

	down := newRouter(&fakeGroups{err: domain.ErrUnavailable})
	if response := call(down, http.MethodGet, "/readyz", nil, ""); response.Code != http.StatusServiceUnavailable {
		t.Fatalf("readyz status %d with the database down, want 503", response.Code)
	}
}

// A duplicate X-Request-Id must not refuse the request: the correlation ID is replaced, not rejected (ADR 0001).
func TestListGroupsAcceptsDuplicateRequestID(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/api/groups", nil)
	request.Header.Set("X-User-Id", alexID)
	request.Header.Add("X-Request-Id", "first")
	request.Header.Add("X-Request-Id", "second")
	response := httptest.NewRecorder()

	newRouter(&fakeGroups{}).ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body %q", response.Code, response.Body.String())
	}
}
