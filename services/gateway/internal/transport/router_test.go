package transport

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"openlobby/pkg/logging"
	"openlobby/pkg/requestid"
	"openlobby/services/gateway/internal/application"
)

const (
	goodToken   = "good-session-token"
	userID      = "0f8c2d4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"
	adminToken  = "admin-session-token"
	adminUserID = "1a8c2d4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"
	evilUserID  = "99999999-9999-4999-8999-999999999999"
)

// fakeSessions is the session port with fixed answers.
type fakeSessions struct {
	sessions map[string]application.Session
	err      error
}

func (f fakeSessions) Validate(_ context.Context, token string) (application.Session, error) {
	if f.err != nil {
		return application.Session{}, f.err
	}
	session, ok := f.sessions[token]
	if !ok {
		return application.Session{}, application.ErrUnauthenticated
	}
	return session, nil
}

func validSessions() fakeSessions {
	return fakeSessions{sessions: map[string]application.Session{
		goodToken:  {UserID: userID},
		adminToken: {UserID: adminUserID, IsSystemAdmin: true},
	}}
}

// received is one request that a stub upstream got.
type received struct {
	path   string
	header http.Header
}

// upstream is a stub service that records what it receives and answers 200.
type upstream struct {
	mu    sync.Mutex
	calls []received
}

func (u *upstream) record(r received) {
	u.mu.Lock()
	defer u.mu.Unlock()
	u.calls = append(u.calls, r)
}

func (u *upstream) count() int {
	u.mu.Lock()
	defer u.mu.Unlock()
	return len(u.calls)
}

func (u *upstream) last(t *testing.T) received {
	t.Helper()
	u.mu.Lock()
	defer u.mu.Unlock()
	if len(u.calls) == 0 {
		t.Fatal("upstream was not called")
	}
	return u.calls[len(u.calls)-1]
}

// stubs are the three upstream stub services and the router's upstream addresses.
type stubs struct {
	auth, calendar, frontend *upstream
	urls                     Upstreams
}

func newStubs(t *testing.T) stubs {
	t.Helper()
	auth, authURL := newUpstream(t)
	calendar, calendarURL := newUpstream(t)
	frontend, frontendURL := newUpstream(t)
	return stubs{auth: auth, calendar: calendar, frontend: frontend,
		urls: Upstreams{Auth: authURL, Calendar: calendarURL, Frontend: frontendURL}}
}

func newUpstream(t *testing.T) (*upstream, *url.URL) {
	t.Helper()
	stub := &upstream{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		stub.record(received{path: r.URL.Path, header: r.Header.Clone()})
		if _, err := io.WriteString(w, "upstream"); err != nil {
			t.Errorf("write upstream body: %v", err)
		}
	}))
	t.Cleanup(server.Close)
	target, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("parse stub URL: %v", err)
	}
	return stub, target
}

// closedURL is the address of a port where nothing listens (a service that is down).
func closedURL(t *testing.T) *url.URL {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	address := listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatalf("close listener: %v", err)
	}
	return &url.URL{Scheme: "http", Host: address}
}

// silentURL accepts one connection and closes it without an answer. The result of the close is sent on the channel.
func silentURL(t *testing.T) (*url.URL, <-chan error) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() {
		if err := listener.Close(); err != nil {
			t.Errorf("close listener: %v", err)
		}
	})
	closed := make(chan error, 1)
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			closed <- err
			return
		}
		closed <- conn.Close()
	}()
	return &url.URL{Scheme: "http", Host: listener.Addr().String()}, closed
}

// receive waits a bounded time so a request that never reaches a stub fails the test instead of hanging it.
func receive[T any](t *testing.T, ch <-chan T) T {
	t.Helper()
	select {
	case value := <-ch:
		return value
	case <-time.After(5 * time.Second):
		t.Fatal("upstream stub was never reached")
		panic("unreachable")
	}
}

// newRouter builds the router and a log buffer that receives every log line.
func newRouter(sessions application.SessionValidator, ups Upstreams) (http.Handler, *bytes.Buffer) {
	logs := &bytes.Buffer{}
	return NewRouter(sessions, ups, logging.New(logs)), logs
}

func cookieHeader(token string) http.Header {
	header := http.Header{}
	header.Set("Cookie", "ol_session="+token)
	return header
}

func send(handler http.Handler, method, target string, header http.Header) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, target, nil)
	for name, values := range header {
		request.Header[name] = values
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

// assertError checks the JSON error envelope of ADR 0001: a code and a request ID, no free text.
func assertError(t *testing.T, recorder *httptest.ResponseRecorder, status int, code string) {
	t.Helper()
	if recorder.Code != status {
		t.Fatalf("status = %d, want %d", recorder.Code, status)
	}
	if contentType := recorder.Header().Get("Content-Type"); contentType != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", contentType)
	}
	var body struct {
		Error struct {
			Code      string `json:"code"`
			RequestID string `json:"requestId"`
		} `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&body); err != nil {
		t.Fatalf("decode error body: %v", err)
	}
	if body.Error.Code != code || body.Error.RequestID == "" {
		t.Errorf("error = %+v, want code %q with a request ID", body.Error, code)
	}
}

func TestUserHeadersAreRemovedFromClient(t *testing.T) {
	tests := []struct {
		name     string
		method   string
		target   string
		cookie   bool
		upstream func(stubs) *upstream
		wantUser bool
	}{
		{"public route", http.MethodPost, "/api/auth/logout", false, func(s stubs) *upstream { return s.auth }, false},
		{"session route", http.MethodGet, "/api/groups", true, func(s stubs) *upstream { return s.calendar }, true},
		{"frontend route", http.MethodGet, "/", false, func(s stubs) *upstream { return s.frontend }, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			s := newStubs(t)
			handler, _ := newRouter(validSessions(), s.urls)
			header := http.Header{}
			header.Set("X-User-Id", evilUserID)
			header.Set("X-User-System-Admin", "true")
			if test.cookie {
				header.Set("Cookie", "ol_session="+goodToken)
			}
			send(handler, test.method, test.target, header)
			got := test.upstream(s).last(t).header
			assertUserHeaders(t, got, test.wantUser)
		})
	}
}

func assertUserHeaders(t *testing.T, header http.Header, wantUser bool) {
	t.Helper()
	if !wantUser {
		for _, name := range []string{"X-User-Id", "X-User-System-Admin"} {
			if _, present := header[http.CanonicalHeaderKey(name)]; present {
				t.Errorf("%s reached the upstream, want it removed", name)
			}
		}
		return
	}
	if got := header.Get("X-User-Id"); got != userID {
		t.Errorf("X-User-Id = %q, want the session's user, not the client's", got)
	}
	if got := header.Get("X-User-System-Admin"); got != "false" {
		t.Errorf("X-User-System-Admin = %q, want false", got)
	}
}

func TestSessionSetsAdminHeader(t *testing.T) {
	s := newStubs(t)
	handler, _ := newRouter(validSessions(), s.urls)
	send(handler, http.MethodGet, "/api/groups", cookieHeader(adminToken))
	got := s.calendar.last(t).header
	if got.Get("X-User-Id") != adminUserID || got.Get("X-User-System-Admin") != "true" {
		t.Errorf("headers = %v, want the admin's user ID and true", got)
	}
}

func TestCookieIsForwardedOnlyToAuth(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		target     string
		upstream   func(stubs) *upstream
		wantCookie bool
	}{
		{"auth me", http.MethodGet, "/api/auth/me", func(s stubs) *upstream { return s.auth }, true},
		{"auth logout", http.MethodPost, "/api/auth/logout", func(s stubs) *upstream { return s.auth }, true},
		{"calendar", http.MethodGet, "/api/groups", func(s stubs) *upstream { return s.calendar }, false},
		{"frontend", http.MethodGet, "/", func(s stubs) *upstream { return s.frontend }, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			s := newStubs(t)
			handler, _ := newRouter(validSessions(), s.urls)
			send(handler, test.method, test.target, cookieHeader(goodToken))
			got := test.upstream(s).last(t).header.Get("Cookie")
			if (got != "") != test.wantCookie {
				t.Errorf("Cookie = %q, want it forwarded: %v", got, test.wantCookie)
			}
		})
	}
}

func TestInternalPathsAreNotFound(t *testing.T) {
	s := newStubs(t)
	handler, _ := newRouter(validSessions(), s.urls)
	for _, method := range []string{http.MethodPost, http.MethodGet} {
		assertError(t, send(handler, method, "/internal/sessions/validate", cookieHeader(goodToken)), http.StatusNotFound, "not_found")
	}
	assertError(t, send(handler, http.MethodPost, "/internal/users/lookup", nil), http.StatusNotFound, "not_found")
	assertNoUpstreamCalls(t, s)
}

func TestUnknownAPIPathIsNotFound(t *testing.T) {
	s := newStubs(t)
	handler, _ := newRouter(validSessions(), s.urls)
	assertError(t, send(handler, http.MethodGet, "/api/unknown", nil), http.StatusNotFound, "not_found")
	assertError(t, send(handler, http.MethodGet, "/api", nil), http.StatusNotFound, "not_found")
	assertNoUpstreamCalls(t, s)
}

func assertNoUpstreamCalls(t *testing.T, s stubs) {
	t.Helper()
	for name, stub := range map[string]*upstream{"auth": s.auth, "calendar": s.calendar, "frontend": s.frontend} {
		if stub.count() != 0 {
			t.Errorf("%s was called, want no call", name)
		}
	}
}

func TestWrongMethodIsMethodNotAllowed(t *testing.T) {
	tests := []struct {
		name   string
		method string
		target string
	}{
		{"known path", http.MethodPatch, "/api/groups"},
		{"login path", http.MethodPost, "/api/auth/login"},
		{"callback path", http.MethodPost, "/api/auth/callback?code=A&state=B"},
		{"lobby player path", http.MethodPost, "/api/groups/1/lobbies/2/players/me"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			s := newStubs(t)
			handler, logs := newRouter(validSessions(), s.urls)
			recorder := send(handler, test.method, test.target, nil)
			assertError(t, recorder, http.StatusMethodNotAllowed, "method_not_allowed")
			assertNoQuery(t, logs.String())
			if recorder.Header().Get("Allow") == "" {
				t.Error("Allow header is missing")
			}
			assertNoUpstreamCalls(t, s)
		})
	}
}

func TestSessionIsRequired(t *testing.T) {
	s := newStubs(t)
	handler, _ := newRouter(validSessions(), s.urls)
	assertError(t, send(handler, http.MethodGet, "/api/groups", nil), http.StatusUnauthorized, "unauthenticated")
	assertError(t, send(handler, http.MethodGet, "/api/groups", cookieHeader("unknown")), http.StatusUnauthorized, "unauthenticated")
	assertError(t, send(handler, http.MethodGet, "/api/groups", cookieHeader("")), http.StatusUnauthorized, "unauthenticated")
	assertNoUpstreamCalls(t, s)
}

func TestSessionServiceUnavailableGives503(t *testing.T) {
	s := newStubs(t)
	handler, _ := newRouter(fakeSessions{err: application.ErrUnavailable}, s.urls)
	assertError(t, send(handler, http.MethodGet, "/api/groups", cookieHeader(goodToken)), http.StatusServiceUnavailable, "service_unavailable")
	assertNoUpstreamCalls(t, s)
}

func TestUnexpectedSessionErrorGives500WithoutDetails(t *testing.T) {
	s := newStubs(t)
	handler, _ := newRouter(fakeSessions{err: io.ErrUnexpectedEOF}, s.urls)
	assertError(t, send(handler, http.MethodGet, "/api/groups", cookieHeader(goodToken)), http.StatusInternalServerError, "internal_error")
	assertNoUpstreamCalls(t, s)
}

func TestUpstreamDownGives503(t *testing.T) {
	s := newStubs(t)
	s.urls.Calendar = closedURL(t)
	handler, _ := newRouter(validSessions(), s.urls)
	assertError(t, send(handler, http.MethodGet, "/api/groups", cookieHeader(goodToken)), http.StatusServiceUnavailable, "service_unavailable")
}

func TestLoginRoutesRedirectWhenAuthIsDown(t *testing.T) {
	s := newStubs(t)
	s.urls.Auth = closedURL(t)
	handler, logs := newRouter(validSessions(), s.urls)
	for _, target := range []string{"/api/auth/login", "/api/auth/callback?code=A&state=B"} {
		recorder := send(handler, http.MethodGet, target, nil)
		if recorder.Code != http.StatusFound || recorder.Header().Get("Location") != "/?loginError=login_failed" {
			t.Errorf("%s: status %d location %q, want 302 to the login error page", target, recorder.Code, recorder.Header().Get("Location"))
		}
		if recorder.Header().Get("Cache-Control") != "no-store" {
			t.Errorf("%s: Cache-Control = %q, want no-store", target, recorder.Header().Get("Cache-Control"))
		}
	}
	assertNoQuery(t, logs.String())
}

func TestUpstreamWithoutAnswerGives500(t *testing.T) {
	s := newStubs(t)
	target, closed := silentURL(t)
	s.urls.Calendar = target
	handler, _ := newRouter(validSessions(), s.urls)
	assertError(t, send(handler, http.MethodGet, "/api/groups", cookieHeader(goodToken)), http.StatusInternalServerError, "internal_error")
	if err := receive(t, closed); err != nil {
		t.Errorf("close silent upstream: %v", err)
	}
}

func TestRequestIDIsPassedOn(t *testing.T) {
	s := newStubs(t)
	handler, _ := newRouter(validSessions(), s.urls)
	header := cookieHeader(goodToken)
	header.Set(requestid.Header, "abc-123")
	recorder := send(handler, http.MethodGet, "/api/groups", header)
	if got := s.calendar.last(t).header.Values(requestid.Header); len(got) != 1 || got[0] != "abc-123" {
		t.Errorf("upstream X-Request-Id = %v, want abc-123", got)
	}
	if got := recorder.Header().Values(requestid.Header); len(got) != 1 || got[0] != "abc-123" {
		t.Errorf("response X-Request-Id = %v, want exactly abc-123", got)
	}
}

func TestTwoRequestIDsAreReplacedByOne(t *testing.T) {
	s := newStubs(t)
	handler, _ := newRouter(validSessions(), s.urls)
	header := cookieHeader(goodToken)
	header.Add("X-Request-Id", "one")
	header.Add("X-Request-Id", "two")
	send(handler, http.MethodGet, "/api/groups", header)
	got := s.calendar.last(t).header.Values("X-Request-Id")
	if len(got) != 1 || got[0] == "one" || got[0] == "two" || got[0] == "" {
		t.Errorf("upstream X-Request-Id = %v, want exactly one new ID", got)
	}
}

func TestAccessLogMasksSecrets(t *testing.T) {
	tests := []struct {
		name     string
		method   string
		target   string
		cookie   bool
		secrets  []string
		wantPath string
	}{
		{"callback query", http.MethodGet, "/api/auth/callback?code=SECRETCODE&state=SECRETSTATE", false,
			[]string{"SECRETCODE", "SECRETSTATE"}, `"path":"/api/auth/callback"`},
		{"join with query", http.MethodPost, "/api/invites/SECRETINVITE/join?x=1", true,
			[]string{"SECRETINVITE", "x=1", goodToken}, `"path":"/api/invites/:token/join"`},
		{"invite page", http.MethodGet, "/invite/SECRETINVITE", false,
			[]string{"SECRETINVITE"}, `"path":"/invite/:token"`},
		{"encoded prefix", http.MethodPost, "/api/%69nvites/SECRETENC/join", true,
			[]string{"SECRETENC"}, `"path":"/api/invites/:token/join"`},
		{"empty segment before token", http.MethodPost, "/api/invites//SECRETEMPTY/join", true,
			[]string{"SECRETEMPTY"}, `"path":"/api/invites/:token/join"`},
		{"empty segment on the page", http.MethodGet, "/invite//SECRETPAGE", false,
			[]string{"SECRETPAGE"}, `"path":"/invite/:token"`},
		{"upper case prefix", http.MethodPost, "/INVITE/SECRETCASE", false,
			[]string{"SECRETCASE"}, `"path":"/invite/:token"`},
		{"encoded slash in token", http.MethodPost, "/api/invites/SECRETA%2FSECRETB/join", true,
			[]string{"SECRETA", "SECRETB"}, `"path":"/api/invites/:token"`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			s := newStubs(t)
			handler, logs := newRouter(validSessions(), s.urls)
			header := http.Header{}
			if test.cookie {
				header = cookieHeader(goodToken)
			}
			send(handler, test.method, test.target, header)
			output := logs.String()
			if !strings.Contains(output, test.wantPath) {
				t.Errorf("log lacks %s:\n%s", test.wantPath, output)
			}
			for _, secret := range test.secrets {
				if strings.Contains(output, secret) {
					t.Errorf("log contains secret %q:\n%s", secret, output)
				}
			}
		})
	}
}

func TestHealthIsServedByGateway(t *testing.T) {
	s := newStubs(t)
	handler, _ := newRouter(validSessions(), s.urls)
	for _, target := range []string{"/healthz", "/readyz"} {
		if recorder := send(handler, http.MethodGet, target, nil); recorder.Code != http.StatusOK {
			t.Errorf("%s status = %d, want 200", target, recorder.Code)
		}
	}
	assertNoUpstreamCalls(t, s)
}

// assertNoQuery checks that a log has no query string: no "?", "code=" or "state=" (ADR 0002 review 4).
func assertNoQuery(t *testing.T, output string) {
	t.Helper()
	for _, marker := range []string{"?", "code=", "state="} {
		if strings.Contains(output, marker) {
			t.Errorf("log contains %q:\n%s", marker, output)
		}
	}
}

func upstreamByName(s stubs, name upstreamName) *upstream {
	switch name {
	case authUpstream:
		return s.auth
	case calendarUpstream:
		return s.calendar
	default:
		return s.frontend
	}
}

// concretePath fills the path parameters of a route with fixed values.
func concretePath(path string) string {
	return strings.NewReplacer("{groupId}", "g1", "{lobbyId}", "l1", "{userId}", "u1",
		"{linkId}", "k1", "{token}", "t1", "{gameId}", "ga1").Replace(path)
}

// TestEveryRouteIsForwardedToItsUpstream pins the route table: method, path, session rule and upstream.
func TestEveryRouteIsForwardedToItsUpstream(t *testing.T) {
	for _, rt := range routes {
		method := rt.method
		if method == "" {
			method = http.MethodGet
		}
		target := concretePath(rt.path)
		t.Run(method+" "+rt.path, func(t *testing.T) {
			if rt.session {
				assertSessionRoute(t, rt, method, target)
				return
			}
			assertPublicRoute(t, rt, method, target)
		})
	}
}

func assertSessionRoute(t *testing.T, rt route, method, target string) {
	t.Helper()
	s := newStubs(t)
	handler, _ := newRouter(validSessions(), s.urls)
	assertError(t, send(handler, method, target, nil), http.StatusUnauthorized, "unauthenticated")
	assertNoUpstreamCalls(t, s)

	s = newStubs(t)
	handler, _ = newRouter(validSessions(), s.urls)
	header := cookieHeader(goodToken)
	header.Set("X-User-Id", evilUserID)
	send(handler, method, target, header)
	got := upstreamByName(s, rt.upstream).last(t)
	if got.path != target {
		t.Errorf("upstream path = %q, want %q", got.path, target)
	}
	assertUserHeaders(t, got.header, true)
	if (got.header.Get("Cookie") != "") != (rt.upstream == authUpstream) {
		t.Errorf("Cookie forwarded = %v, want only to auth", got.header.Get("Cookie") != "")
	}
}

func assertPublicRoute(t *testing.T, rt route, method, target string) {
	t.Helper()
	s := newStubs(t)
	handler, _ := newRouter(validSessions(), s.urls)
	header := cookieHeader(goodToken)
	header.Set("X-User-Id", evilUserID)
	send(handler, method, target, header)
	got := upstreamByName(s, rt.upstream).last(t)
	if got.path != target {
		t.Errorf("upstream path = %q, want %q", got.path, target)
	}
	assertUserHeaders(t, got.header, false)
}

func TestResponseHeaderTimeoutGives500(t *testing.T) {
	s := newStubs(t)
	s.urls.Calendar = stalledURL(t)
	handler := buildRouter(validSessions(), s.urls, logging.New(io.Discard), shortTimeouts())
	assertError(t, send(handler, http.MethodGet, "/api/groups", cookieHeader(goodToken)), http.StatusInternalServerError, "internal_error")
}

// TestProxiedResponseHasOneRequestID: an upstream that echoes X-Request-Id must not add a second value (ADR 0002 review 5).
func TestProxiedResponseHasOneRequestID(t *testing.T) {
	received := make(chan string, 1)
	echo := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- r.Header.Get(requestid.Header)
		w.Header().Add(requestid.Header, r.Header.Get(requestid.Header))
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(echo.Close)
	echoURL, err := url.Parse(echo.URL)
	if err != nil {
		t.Fatalf("parse stub URL: %v", err)
	}
	s := newStubs(t)
	s.urls.Auth = echoURL
	handler, _ := newRouter(validSessions(), s.urls)
	header := http.Header{}
	header.Set(requestid.Header, "abc-123")
	recorder := send(handler, http.MethodPost, "/api/auth/logout", header)
	if got := receive(t, received); got != "abc-123" {
		t.Errorf("upstream X-Request-Id = %q, want abc-123", got)
	}
	if got := recorder.Header().Values(requestid.Header); len(got) != 1 || got[0] != "abc-123" {
		t.Errorf("response X-Request-Id = %v, want exactly abc-123", got)
	}
}

// stalledURL is an upstream that accepts requests and never answers.
func stalledURL(t *testing.T) *url.URL {
	t.Helper()
	stalled := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	t.Cleanup(stalled.Close)
	stalledAddress, err := url.Parse(stalled.URL)
	if err != nil {
		t.Fatalf("parse stub URL: %v", err)
	}
	return stalledAddress
}

// shortTimeouts makes the response header timeout fire within a test.
func shortTimeouts() upstreamTimeouts {
	return upstreamTimeouts{dial: dialTimeout, responseHeader: 100 * time.Millisecond}
}

// TestErrorAnswersHaveOneRequestID: every answer of the gateway's own errors and redirects carries exactly one
// X-Request-Id, equal to the one the client sent (ADR 0002 review 5).
func TestErrorAnswersHaveOneRequestID(t *testing.T) {
	tests := []struct {
		name   string
		method string
		target string
		header http.Header
		router func(*testing.T) http.Handler
	}{
		{"upstream down gives 503", http.MethodGet, "/api/groups", cookieHeader(goodToken), func(t *testing.T) http.Handler {
			s := newStubs(t)
			s.urls.Calendar = closedURL(t)
			return NewRouter(validSessions(), s.urls, logging.New(io.Discard))
		}},
		{"upstream timeout gives 500", http.MethodGet, "/api/groups", cookieHeader(goodToken), func(t *testing.T) http.Handler {
			s := newStubs(t)
			s.urls.Calendar = stalledURL(t)
			return buildRouter(validSessions(), s.urls, logging.New(io.Discard), shortTimeouts())
		}},
		{"login redirect", http.MethodGet, "/api/auth/login", http.Header{}, func(t *testing.T) http.Handler {
			s := newStubs(t)
			s.urls.Auth = closedURL(t)
			return NewRouter(validSessions(), s.urls, logging.New(io.Discard))
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			header := test.header.Clone()
			header.Set(requestid.Header, "err-123")
			recorder := send(test.router(t), test.method, test.target, header)
			if got := recorder.Header().Values(requestid.Header); len(got) != 1 || got[0] != "err-123" {
				t.Errorf("response X-Request-Id = %v, want exactly err-123", got)
			}
		})
	}
}
