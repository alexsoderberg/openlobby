package transport_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"openlobby/services/auth/internal/application"
	"openlobby/services/auth/internal/application/applicationtest"
	"openlobby/services/auth/internal/domain"
	"openlobby/services/auth/internal/transport"
)

const loginRedirectTarget = "https://provider.test/authorize"

var start = time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)

type server struct {
	t     *testing.T
	store *applicationtest.Memory
	http  http.Handler
}

func newServer(t *testing.T, admins domain.SystemAdmins) server {
	t.Helper()
	store := applicationtest.New(start)
	store.Identity.Result = application.ExternalIdentity{Provider: "discord", SubjectID: "111", DisplayName: "Alex"}
	auth := application.NewAuth(store.Ports(admins), slog.New(slog.NewTextHandler(io.Discard, nil)))
	ready := func(context.Context) error {
		if store.Down {
			return domain.ErrUnavailable
		}
		return nil
	}
	return server{
		t:     t,
		store: store,
		http:  transport.NewRouter(auth, ready, slog.New(slog.NewTextHandler(io.Discard, nil))),
	}
}

func (s server) do(method, target string, body string, headers map[string]string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	s.t.Helper()
	request := httptest.NewRequest(method, target, strings.NewReader(body))
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}
	response := httptest.NewRecorder()
	s.http.ServeHTTP(response, request)
	return response
}

// login runs the whole flow and returns the session token and the user ID.
func (s server) login(returnTo string) (token, userID string) {
	s.t.Helper()
	started := s.do(http.MethodGet, "/api/auth/login?returnTo="+returnTo, "", nil)
	state := cookieNamed(s.t, started, "ol_login").Value
	callback := s.do(http.MethodGet, "/api/auth/callback?code=c&state="+state, "", nil,
		&http.Cookie{Name: "ol_login", Value: state})
	token = cookieNamed(s.t, callback, "ol_session").Value
	account := s.do(http.MethodPost, "/internal/sessions/validate", fmt.Sprintf(`{"token":%q}`, token), jsonHeader())
	var validation struct {
		UserID string `json:"userId"`
	}
	decode(s.t, account, &validation)
	return token, validation.UserID
}

func jsonHeader() map[string]string {
	return map[string]string{"Content-Type": "application/json"}
}

func cookieNamed(t *testing.T, response *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()
	for _, cookie := range response.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	t.Fatalf("response has no cookie %q; headers %v", name, response.Header())
	return nil
}

func decode(t *testing.T, response *httptest.ResponseRecorder, target any) {
	t.Helper()
	if err := json.Unmarshal(response.Body.Bytes(), target); err != nil {
		t.Fatalf("decode %q: %v", response.Body.String(), err)
	}
}

// assertErrorEnvelope checks the exact shape of ADR 0001: a code and a request ID, and no other field.
func assertErrorEnvelope(t *testing.T, response *httptest.ResponseRecorder, wantStatus int, wantCode string) {
	t.Helper()
	if response.Code != wantStatus {
		t.Fatalf("status %d, want %d; body %q", response.Code, wantStatus, response.Body.String())
	}
	var body map[string]map[string]string
	decode(t, response, &body)
	envelope := body["error"]
	if len(body) != 1 || len(envelope) != 2 || envelope["code"] != wantCode || envelope["requestId"] == "" {
		t.Fatalf("envelope %q, want code %q and a requestId", response.Body.String(), wantCode)
	}
	if envelope["requestId"] != response.Header().Get("X-Request-Id") {
		t.Fatalf("requestId %q differs from the X-Request-Id header", envelope["requestId"])
	}
}

func TestStartLoginRedirectsAndBindsBrowser(t *testing.T) {
	s := newServer(t, nil)
	response := s.do(http.MethodGet, "/api/auth/login?returnTo=/groups/1", "", nil)

	if response.Code != http.StatusFound {
		t.Fatalf("status %d, want 302", response.Code)
	}
	if location := response.Header().Get("Location"); !strings.HasPrefix(location, loginRedirectTarget) {
		t.Fatalf("Location %q is not the provider URL", location)
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("login response is not no-store")
	}
	cookie := cookieNamed(t, response, "ol_login")
	if cookie.Path != "/api/auth/callback" || cookie.MaxAge != 600 || !cookie.HttpOnly || !cookie.Secure ||
		cookie.SameSite != http.SameSiteLaxMode || cookie.Value == "" {
		t.Fatalf("ol_login attributes wrong: %+v", cookie)
	}
	if !strings.Contains(response.Header().Get("Location"), "state="+cookie.Value) {
		t.Fatal("the cookie value is not the state sent to the provider")
	}
}

func TestStartLoginFailureRedirectsWithoutCookie(t *testing.T) {
	s := newServer(t, nil)
	s.store.Down = true
	response := s.do(http.MethodGet, "/api/auth/login", "", nil)

	if response.Code != http.StatusFound || response.Header().Get("Location") != "/?loginError=login_failed" {
		t.Fatalf("status %d, Location %q", response.Code, response.Header().Get("Location"))
	}
	for _, cookie := range response.Result().Cookies() {
		if cookie.Name == "ol_login" {
			t.Fatal("failed start set the login cookie")
		}
	}
}

func TestDuplicateParameterRedirectsToLoginError(t *testing.T) {
	s := newServer(t, nil)
	login := s.do(http.MethodGet, "/api/auth/login?returnTo=/a&returnTo=/b", "", nil)
	if login.Header().Get("Location") != "/?loginError=login_failed" {
		t.Fatalf("login with two returnTo: Location %q", login.Header().Get("Location"))
	}
	callback := s.do(http.MethodGet, "/api/auth/callback?code=c&state=a&state=b", "", nil)
	if callback.Code != http.StatusFound || callback.Header().Get("Location") != "/?loginError=login_failed" {
		t.Fatalf("callback with two states: status %d, Location %q", callback.Code, callback.Header().Get("Location"))
	}
}

func TestCallbackSuccessSetsSessionCookieAndClearsLoginCookie(t *testing.T) {
	s := newServer(t, nil)
	login := s.do(http.MethodGet, "/api/auth/login?returnTo=/groups/1", "", nil)
	state := cookieNamed(t, login, "ol_login").Value

	response := s.do(http.MethodGet, "/api/auth/callback?code=c&state="+state, "", nil,
		&http.Cookie{Name: "ol_login", Value: state})

	if response.Code != http.StatusFound || response.Header().Get("Location") != "/groups/1" {
		t.Fatalf("status %d, Location %q", response.Code, response.Header().Get("Location"))
	}
	if response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("callback response is not no-store")
	}
	session := cookieNamed(t, response, "ol_session")
	if session.Path != "/" || session.MaxAge != int(domain.SessionLifetime.Seconds()) || !session.HttpOnly ||
		!session.Secure || session.SameSite != http.SameSiteLaxMode || session.Value == "" {
		t.Fatalf("ol_session attributes wrong: %+v", session)
	}
	if cleared := cookieNamed(t, response, "ol_login"); cleared.MaxAge >= 0 || cleared.Value != "" {
		t.Fatalf("ol_login was not cleared: %+v", cleared)
	}
}

func TestCallbackFailuresRedirectWithoutSession(t *testing.T) {
	tests := []struct {
		name     string
		target   string
		cookie   string // value of ol_login sent with the request, "" for none
		location string
		prepare  func(s server)
	}{
		{
			name:     "denied by the user, no state",
			target:   "/api/auth/callback?error=access_denied",
			location: "/?loginError=login_denied",
		},
		{
			name:     "other provider error",
			target:   "/api/auth/callback?error=server_error&state=x",
			cookie:   "x",
			location: "/?loginError=login_failed",
		},
		{
			name:     "missing ol_login cookie",
			target:   "/api/auth/callback?code=c&state=s",
			location: "/?loginError=login_failed",
		},
		{
			name:     "cookie differs from state",
			target:   "/api/auth/callback?code=c&state=s",
			cookie:   "other",
			location: "/?loginError=login_failed",
		},
		{
			name:     "missing code",
			target:   "/api/auth/callback?state=s",
			cookie:   "s",
			location: "/?loginError=login_failed",
		},
		{
			name:     "unknown state",
			target:   "/api/auth/callback?code=c&state=s",
			cookie:   "s",
			location: "/?loginError=login_failed",
		},
		{
			name:     "database down",
			target:   "/api/auth/callback?code=c&state=s",
			cookie:   "s",
			location: "/?loginError=login_failed",
			prepare:  func(s server) { s.store.Down = true },
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := newServer(t, nil)
			if tc.prepare != nil {
				tc.prepare(s)
			}
			var cookies []*http.Cookie
			if tc.cookie != "" {
				cookies = append(cookies, &http.Cookie{Name: "ol_login", Value: tc.cookie})
			}
			response := s.do(http.MethodGet, tc.target, "", nil, cookies...)

			if response.Code != http.StatusFound || response.Header().Get("Location") != tc.location {
				t.Fatalf("status %d, Location %q, want %q", response.Code, response.Header().Get("Location"), tc.location)
			}
			for _, cookie := range response.Result().Cookies() {
				if cookie.Name == "ol_session" {
					t.Fatal("a failed callback set a session cookie")
				}
			}
			if cleared := cookieNamed(t, response, "ol_login"); cleared.MaxAge >= 0 {
				t.Fatal("ol_login is not cleared on a failed callback")
			}
		})
	}
}

func TestCallbackRejectsReusedState(t *testing.T) {
	s := newServer(t, nil)
	login := s.do(http.MethodGet, "/api/auth/login", "", nil)
	state := cookieNamed(t, login, "ol_login").Value
	cookie := &http.Cookie{Name: "ol_login", Value: state}
	s.do(http.MethodGet, "/api/auth/callback?code=c&state="+state, "", nil, cookie)

	again := s.do(http.MethodGet, "/api/auth/callback?code=c&state="+state, "", nil, cookie)
	if again.Header().Get("Location") != "/?loginError=login_failed" {
		t.Fatalf("second use of the state: Location %q", again.Header().Get("Location"))
	}
}

func TestCallbackDeniedAfterLoginAttempt(t *testing.T) {
	s := newServer(t, nil)
	login := s.do(http.MethodGet, "/api/auth/login", "", nil)
	state := cookieNamed(t, login, "ol_login").Value

	response := s.do(http.MethodGet, "/api/auth/callback?error=access_denied&state="+state, "", nil,
		&http.Cookie{Name: "ol_login", Value: state})
	if response.Header().Get("Location") != "/?loginError=login_denied" {
		t.Fatalf("Location %q", response.Header().Get("Location"))
	}
}

func TestLogoutDeletesSessionAndIsIdempotent(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.login("/")

	first := s.do(http.MethodPost, "/api/auth/logout", "", nil, &http.Cookie{Name: "ol_session", Value: token})
	if first.Code != http.StatusNoContent {
		t.Fatalf("status %d, want 204", first.Code)
	}
	if cleared := cookieNamed(t, first, "ol_session"); cleared.MaxAge >= 0 || cleared.Path != "/" {
		t.Fatalf("ol_session was not cleared: %+v", cleared)
	}
	if s.store.SessionCount() != 0 {
		t.Fatal("session was not deleted")
	}
	second := s.do(http.MethodPost, "/api/auth/logout", "", nil)
	if second.Code != http.StatusNoContent {
		t.Fatalf("logout without cookie: status %d, want 204", second.Code)
	}
}

func TestLogoutReturns503WhenDatabaseDown(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.login("/")
	s.store.Down = true

	response := s.do(http.MethodPost, "/api/auth/logout", "", nil, &http.Cookie{Name: "ol_session", Value: token})
	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}

func TestCurrentUserRequiresIdentityFromGateway(t *testing.T) {
	s := newServer(t, nil)
	_, userID := s.login("/")

	unauthenticated := []map[string]string{nil, {"X-User-Id": "not-a-uuid"}, {"X-User-Id": "00000000-0000-4000-8000-999999999999"}}
	for _, headers := range unauthenticated {
		response := s.do(http.MethodGet, "/api/auth/me", "", headers)
		assertErrorEnvelope(t, response, http.StatusUnauthorized, "unauthenticated")
	}

	response := s.do(http.MethodGet, "/api/auth/me", "", map[string]string{"X-User-Id": userID})
	if response.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", response.Code)
	}
	var user map[string]any
	decode(t, response, &user)
	if user["userId"] != userID || user["displayName"] != "Alex" || user["isSystemAdmin"] != false {
		t.Fatalf("body %v", user)
	}
}

func TestCurrentUserReturns503WhenDatabaseDown(t *testing.T) {
	s := newServer(t, nil)
	_, userID := s.login("/")
	s.store.Down = true
	response := s.do(http.MethodGet, "/api/auth/me", "", map[string]string{"X-User-Id": userID})
	assertErrorEnvelope(t, response, http.StatusServiceUnavailable, "service_unavailable")
}

func TestValidateSessionResponses(t *testing.T) {
	s := newServer(t, nil)
	token, userID := s.login("/")

	valid := s.do(http.MethodPost, "/internal/sessions/validate", fmt.Sprintf(`{"token":%q}`, token), jsonHeader())
	if valid.Code != http.StatusOK {
		t.Fatalf("valid token: status %d", valid.Code)
	}
	var body map[string]any
	decode(t, valid, &body)
	if body["userId"] != userID || body["isSystemAdmin"] != false {
		t.Fatalf("body %v", body)
	}

	tests := []struct {
		name   string
		body   string
		status int
		code   string
	}{
		{name: "missing token", body: `{}`, status: http.StatusUnauthorized, code: "unauthenticated"},
		{name: "empty token", body: `{"token":""}`, status: http.StatusUnauthorized, code: "unauthenticated"},
		{name: "unknown token", body: `{"token":"nope"}`, status: http.StatusUnauthorized, code: "unauthenticated"},
		{name: "invalid JSON", body: `{"token":`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "wrong JSON type", body: `{"token":5}`, status: http.StatusBadRequest, code: "invalid_request"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assertErrorEnvelope(t, s.do(http.MethodPost, "/internal/sessions/validate", tc.body, jsonHeader()), tc.status, tc.code)
		})
	}

	s.store.Down = true
	assertErrorEnvelope(t, s.do(http.MethodPost, "/internal/sessions/validate",
		fmt.Sprintf(`{"token":%q}`, token), jsonHeader()), http.StatusServiceUnavailable, "service_unavailable")
}

func TestValidateSessionBodyLimit(t *testing.T) {
	s := newServer(t, nil)
	large := `{"token":"` + strings.Repeat("a", 16<<10) + `"}`
	assertErrorEnvelope(t, s.do(http.MethodPost, "/internal/sessions/validate", large, jsonHeader()),
		http.StatusBadRequest, "invalid_request")
}

func TestLookupUsersResponses(t *testing.T) {
	s := newServer(t, nil)
	_, userID := s.login("/")

	ids := func(count int) string {
		values := make([]string, count)
		for i := range values {
			values[i] = fmt.Sprintf("%q", userID)
		}
		return "[" + strings.Join(values, ",") + "]"
	}
	tests := []struct {
		name   string
		body   string
		status int
		code   string
		users  int
	}{
		{name: "one known user", body: `{"userIds":[` + fmt.Sprintf("%q", userID) + `]}`, status: http.StatusOK, users: 1},
		{name: "100 IDs accepted", body: `{"userIds":` + ids(100) + `}`, status: http.StatusOK, users: 1},
		{name: "101 IDs rejected", body: `{"userIds":` + ids(101) + `}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "missing userIds gives empty list", body: `{}`, status: http.StatusOK},
		{name: "null userIds gives empty list", body: `{"userIds":null}`, status: http.StatusOK},
		{name: "invalid uuid", body: `{"userIds":["nope"]}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "invalid JSON", body: `{"userIds":`, status: http.StatusBadRequest, code: "invalid_request"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			response := s.do(http.MethodPost, "/internal/users/lookup", tc.body, jsonHeader())
			if tc.code != "" {
				assertErrorEnvelope(t, response, tc.status, tc.code)
				return
			}
			if response.Code != tc.status {
				t.Fatalf("status %d, want %d; body %q", response.Code, tc.status, response.Body.String())
			}
			var body struct {
				Users []map[string]string `json:"users"`
			}
			decode(t, response, &body)
			if body.Users == nil {
				t.Fatalf("users is null, want []: %q", response.Body.String())
			}
			if len(body.Users) != tc.users {
				t.Fatalf("got %d users, want %d", len(body.Users), tc.users)
			}
		})
	}
}

// TestUnexpectedErrorGives500WithoutDetails checks that a SQL bug is not reported as an outage (ADR 0001, item 8).
func TestUnexpectedErrorGives500WithoutDetails(t *testing.T) {
	s := newServer(t, nil)
	_, userID := s.login("/")
	s.store.Failure = errors.New("SECRET-SQL-DETAIL")

	me := s.do(http.MethodGet, "/api/auth/me", "", map[string]string{"X-User-Id": userID})
	assertErrorEnvelope(t, me, http.StatusInternalServerError, "internal_error")
	validate := s.do(http.MethodPost, "/internal/sessions/validate", `{"token":"x"}`, jsonHeader())
	assertErrorEnvelope(t, validate, http.StatusInternalServerError, "internal_error")
	for _, response := range []*httptest.ResponseRecorder{me, validate} {
		if strings.Contains(response.Body.String(), "SECRET-SQL-DETAIL") {
			t.Fatalf("500 body leaks the error: %q", response.Body.String())
		}
	}
}

func TestLogoutUnexpectedErrorGives500(t *testing.T) {
	s := newServer(t, nil)
	token, _ := s.login("/")
	s.store.Failure = errors.New("SECRET-SQL-DETAIL")

	response := s.do(http.MethodPost, "/api/auth/logout", "", nil, &http.Cookie{Name: "ol_session", Value: token})
	assertErrorEnvelope(t, response, http.StatusInternalServerError, "internal_error")
	if strings.Contains(response.Body.String(), "SECRET-SQL-DETAIL") {
		t.Fatalf("500 body leaks the error: %q", response.Body.String())
	}
}

// TestSystemAdminFlagFollowsConfiguration checks that the role comes from SYSTEM_ADMINS on every call (ADR 0011).
func TestSystemAdminFlagFollowsConfiguration(t *testing.T) {
	admins, err := domain.ParseSystemAdmins("discord:111", []string{"discord"})
	if err != nil {
		t.Fatal(err)
	}
	s := newServer(t, admins)

	adminToken, adminID := s.login("/")
	me := s.do(http.MethodGet, "/api/auth/me", "", map[string]string{"X-User-Id": adminID})
	var account map[string]any
	decode(t, me, &account)
	if account["isSystemAdmin"] != true {
		t.Fatalf("configured subject: /me isSystemAdmin = %v", account["isSystemAdmin"])
	}
	validate := s.do(http.MethodPost, "/internal/sessions/validate", fmt.Sprintf(`{"token":%q}`, adminToken), jsonHeader())
	var validation map[string]any
	decode(t, validate, &validation)
	if validation["isSystemAdmin"] != true {
		t.Fatalf("configured subject: validate isSystemAdmin = %v", validation["isSystemAdmin"])
	}

	s.store.Identity.Result.SubjectID = "222"
	otherToken, otherID := s.login("/")
	me = s.do(http.MethodGet, "/api/auth/me", "", map[string]string{"X-User-Id": otherID})
	decode(t, me, &account)
	if account["isSystemAdmin"] != false {
		t.Fatalf("other subject: /me isSystemAdmin = %v", account["isSystemAdmin"])
	}
	validate = s.do(http.MethodPost, "/internal/sessions/validate", fmt.Sprintf(`{"token":%q}`, otherToken), jsonHeader())
	decode(t, validate, &validation)
	if validation["isSystemAdmin"] != false {
		t.Fatalf("other subject: validate isSystemAdmin = %v", validation["isSystemAdmin"])
	}
}

func TestHealthEndpoints(t *testing.T) {
	s := newServer(t, nil)
	if response := s.do(http.MethodGet, "/healthz", "", nil); response.Code != http.StatusOK {
		t.Fatalf("/healthz status %d", response.Code)
	}
	if response := s.do(http.MethodGet, "/readyz", "", nil); response.Code != http.StatusOK {
		t.Fatalf("/readyz status %d", response.Code)
	}
}

func TestRequestIDIsKeptWhenValidAndReplacedWhenNot(t *testing.T) {
	s := newServer(t, nil)
	if id := s.do(http.MethodGet, "/healthz", "", map[string]string{"X-Request-Id": "abc-123"}).Header().Get("X-Request-Id"); id != "abc-123" {
		t.Fatalf("valid ID became %q", id)
	}
	if id := s.do(http.MethodGet, "/healthz", "", map[string]string{"X-Request-Id": "bad id"}).Header().Get("X-Request-Id"); id == "" || id == "bad id" {
		t.Fatalf("invalid ID was not replaced: %q", id)
	}
}
