package application_test

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"log/slog"
	"net/url"
	"testing"
	"time"

	"openlobby/services/auth/internal/application"
	"openlobby/services/auth/internal/application/applicationtest"
	"openlobby/services/auth/internal/domain"
)

var start = time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)

type fixture struct {
	store *applicationtest.Memory
	auth  *application.Auth
}

func newFixture(admins domain.SystemAdmins) fixture {
	store := applicationtest.New(start)
	store.Identity.Result = application.ExternalIdentity{Provider: "discord", SubjectID: "111", DisplayName: "Alex"}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return fixture{store: store, auth: application.NewAuth(store.Ports(admins), logger)}
}

// startLogin starts a login and returns what the browser holds and what the provider sends back.
func (f fixture) startLogin(t *testing.T, returnTo string) (application.LoginStart, application.LoginCallback) {
	t.Helper()
	started, err := f.auth.StartLogin(context.Background(), returnTo)
	if err != nil {
		t.Fatalf("StartLogin: %v", err)
	}
	return started, application.LoginCallback{Code: "code", State: started.State, CookieState: started.State}
}

// loginAs completes a full login and returns the session and the account it belongs to.
func (f fixture) loginAs(t *testing.T) (application.LoginResult, application.Account) {
	t.Helper()
	_, callback := f.startLogin(t, "/groups/1")
	result, err := f.auth.CompleteLogin(context.Background(), callback)
	if err != nil {
		t.Fatalf("CompleteLogin: %v", err)
	}
	account, err := f.auth.ValidateSession(context.Background(), result.SessionToken)
	if err != nil {
		t.Fatalf("ValidateSession after login: %v", err)
	}
	return result, account
}

func TestStartLoginSendsStateAndS256Challenge(t *testing.T) {
	f := newFixture(nil)
	started, err := f.auth.StartLogin(context.Background(), "/")
	if err != nil {
		t.Fatal(err)
	}
	query, err := url.Parse(started.AuthorizationURL)
	if err != nil {
		t.Fatal(err)
	}
	if query.Query().Get("state") != started.State {
		t.Fatal("authorization URL does not carry the state of the browser cookie")
	}
	if query.Query().Get("code_challenge") == "" {
		t.Fatal("authorization URL has no PKCE challenge")
	}
	if f.store.AttemptCount() != 1 {
		t.Fatalf("stored %d attempts, want 1", f.store.AttemptCount())
	}
}

func TestExchangeReceivesVerifierMatchingTheChallenge(t *testing.T) {
	f := newFixture(nil)
	started, callback := f.startLogin(t, "/")
	if _, err := f.auth.CompleteLogin(context.Background(), callback); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256([]byte(f.store.Identity.LastVerifier))
	wantChallenge := base64.RawURLEncoding.EncodeToString(sum[:])

	query, _ := url.Parse(started.AuthorizationURL)
	if query.Query().Get("code_challenge") != wantChallenge {
		t.Fatal("the verifier given to the provider does not match the challenge sent to Discord")
	}
}

func TestCompleteLoginRedirectsToSafeReturnTo(t *testing.T) {
	tests := []struct {
		name   string
		raw    string
		wantTo string
	}{
		{name: "group path", raw: "/groups/123", wantTo: "/groups/123"},
		{name: "backslash trick", raw: `/\evil.example`, wantTo: "/"},
		{name: "protocol relative", raw: "//evil.example", wantTo: "/"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(nil)
			_, callback := f.startLogin(t, tc.raw)
			result, err := f.auth.CompleteLogin(context.Background(), callback)
			if err != nil {
				t.Fatalf("CompleteLogin: %v", err)
			}
			if result.ReturnTo != tc.wantTo {
				t.Fatalf("ReturnTo = %q, want %q", result.ReturnTo, tc.wantTo)
			}
		})
	}
}

func TestFirstLoginCreatesUserAndSessionAndConsumesAttempt(t *testing.T) {
	f := newFixture(nil)
	result, account := f.loginAs(t)

	if f.store.UserCount() != 1 {
		t.Fatalf("users = %d, want 1", f.store.UserCount())
	}
	if f.store.SessionCount() != 1 {
		t.Fatalf("sessions = %d, want 1", f.store.SessionCount())
	}
	if result.SessionToken == "" || account.UserID == "" || account.DisplayName != "Alex" {
		t.Fatalf("unexpected result %+v and account %+v", result, account)
	}
	if f.store.AttemptCount() != 0 {
		t.Fatal("login attempt was not consumed")
	}
}

func TestDisplayNameIsUpdatedAtNextLogin(t *testing.T) {
	f := newFixture(nil)
	_, first := f.loginAs(t)
	f.store.Identity.Result.DisplayName = "Alex Renamed"
	_, second := f.loginAs(t)

	if second.DisplayName != "Alex Renamed" {
		t.Fatalf("display name %q, want the name of the latest login", second.DisplayName)
	}
	if second.UserID != first.UserID || f.store.UserCount() != 1 {
		t.Fatal("a second login with the same provider subject created another user")
	}
}

func TestCompleteLoginFailures(t *testing.T) {
	tests := []struct {
		name         string
		prepare      func(t *testing.T, f fixture) application.LoginCallback
		wantErr      error
		attemptsLeft int
	}{
		{
			name: "denied at provider, regardless of state",
			prepare: func(t *testing.T, f fixture) application.LoginCallback {
				started, _ := f.startLogin(t, "/")
				return application.LoginCallback{ProviderError: "access_denied", State: started.State, CookieState: started.State}
			},
			wantErr:      application.ErrLoginDenied,
			attemptsLeft: 1,
		},
		{
			name: "other provider error",
			prepare: func(t *testing.T, _ fixture) application.LoginCallback {
				return application.LoginCallback{ProviderError: "server_error"}
			},
			wantErr: application.ErrLoginFailed,
		},
		{
			name: "missing code",
			prepare: func(t *testing.T, f fixture) application.LoginCallback {
				started, _ := f.startLogin(t, "/")
				return application.LoginCallback{State: started.State, CookieState: started.State}
			},
			wantErr:      application.ErrLoginFailed,
			attemptsLeft: 1,
		},
		{
			name: "cookie differs from state, attempt is left untouched",
			prepare: func(t *testing.T, f fixture) application.LoginCallback {
				_, callback := f.startLogin(t, "/")
				callback.CookieState += "-other"
				return callback
			},
			wantErr:      application.ErrLoginFailed,
			attemptsLeft: 1,
		},
		{
			name: "missing cookie, attempt is left untouched",
			prepare: func(t *testing.T, f fixture) application.LoginCallback {
				_, callback := f.startLogin(t, "/")
				callback.CookieState = ""
				return callback
			},
			wantErr:      application.ErrLoginFailed,
			attemptsLeft: 1,
		},
		{
			name: "unknown state",
			prepare: func(t *testing.T, _ fixture) application.LoginCallback {
				return application.LoginCallback{Code: "c", State: "unknown", CookieState: "unknown"}
			},
			wantErr: application.ErrLoginFailed,
		},
		{
			name: "expired attempt",
			prepare: func(t *testing.T, f fixture) application.LoginCallback {
				_, callback := f.startLogin(t, "/")
				f.store.Now = start.Add(domain.LoginAttemptLifetime)
				return callback
			},
			wantErr: application.ErrLoginFailed,
		},
		{
			name: "provider exchange fails",
			prepare: func(t *testing.T, f fixture) application.LoginCallback {
				_, callback := f.startLogin(t, "/")
				f.store.Identity.Err = errors.New("provider said no")
				return callback
			},
			wantErr: application.ErrLoginFailed,
		},
		{
			name: "database down",
			prepare: func(t *testing.T, f fixture) application.LoginCallback {
				_, callback := f.startLogin(t, "/")
				f.store.Down = true
				return callback
			},
			wantErr: application.ErrLoginFailed,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			f := newFixture(nil)
			callback := tc.prepare(t, f)
			_, err := f.auth.CompleteLogin(context.Background(), callback)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("err = %v, want %v", err, tc.wantErr)
			}
			if f.store.SessionCount() != 0 {
				t.Fatal("a failed login created a session")
			}
			if tc.attemptsLeft > 0 && f.store.AttemptCount() != tc.attemptsLeft {
				t.Fatalf("attempts = %d, want %d", f.store.AttemptCount(), tc.attemptsLeft)
			}
		})
	}
}

func TestReplayedStateFails(t *testing.T) {
	f := newFixture(nil)
	_, callback := f.startLogin(t, "/")
	if _, err := f.auth.CompleteLogin(context.Background(), callback); err != nil {
		t.Fatal(err)
	}
	if _, err := f.auth.CompleteLogin(context.Background(), callback); !errors.Is(err, application.ErrLoginFailed) {
		t.Fatalf("second use of the state: err = %v, want ErrLoginFailed", err)
	}
}

func TestSessionExpiresAfterThirtyDays(t *testing.T) {
	f := newFixture(nil)
	result, _ := f.loginAs(t)

	f.store.Now = start.Add(domain.SessionLifetime - time.Second)
	if _, err := f.auth.ValidateSession(context.Background(), result.SessionToken); err != nil {
		t.Fatalf("session before expiry: %v", err)
	}
	f.store.Now = start.Add(domain.SessionLifetime)
	if _, err := f.auth.ValidateSession(context.Background(), result.SessionToken); !errors.Is(err, application.ErrUnauthenticated) {
		t.Fatalf("session at expiry: err = %v, want ErrUnauthenticated", err)
	}
}

func TestValidateSessionRejectsEmptyAndUnknownTokens(t *testing.T) {
	f := newFixture(nil)
	for _, token := range []string{"", "unknown"} {
		if _, err := f.auth.ValidateSession(context.Background(), token); !errors.Is(err, application.ErrUnauthenticated) {
			t.Fatalf("token %q: err = %v, want ErrUnauthenticated", token, err)
		}
	}
}

func TestSystemAdminIsDecidedFromConfiguration(t *testing.T) {
	admins, err := domain.ParseSystemAdmins("discord:111", []string{"discord"})
	if err != nil {
		t.Fatal(err)
	}
	if _, account := newFixture(admins).loginAs(t); !account.IsSystemAdmin {
		t.Fatal("configured subject is not a system admin")
	}
	if _, account := newFixture(nil).loginAs(t); account.IsSystemAdmin {
		t.Fatal("subject without configuration is a system admin")
	}
}

func TestLogoutDeletesSessionAndIsIdempotent(t *testing.T) {
	f := newFixture(nil)
	result, _ := f.loginAs(t)

	for range 2 {
		if err := f.auth.Logout(context.Background(), result.SessionToken); err != nil {
			t.Fatalf("Logout: %v", err)
		}
	}
	if _, err := f.auth.ValidateSession(context.Background(), result.SessionToken); !errors.Is(err, application.ErrUnauthenticated) {
		t.Fatalf("token after logout: err = %v, want ErrUnauthenticated", err)
	}
}

func TestLogoutReportsUnavailableDatabase(t *testing.T) {
	f := newFixture(nil)
	result, _ := f.loginAs(t)
	f.store.Down = true
	if err := f.auth.Logout(context.Background(), result.SessionToken); !errors.Is(err, domain.ErrUnavailable) {
		t.Fatalf("err = %v, want ErrUnavailable", err)
	}
}

func TestLookupUsersReturnsOnlyKnownUsers(t *testing.T) {
	f := newFixture(nil)
	_, account := f.loginAs(t)

	users, err := f.auth.LookupUsers(context.Background(), []string{account.UserID, "00000000-0000-4000-8000-999999999999"})
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 1 || users[0].ID != account.UserID {
		t.Fatalf("users = %+v, want only the known user", users)
	}
	if users, err := f.auth.LookupUsers(context.Background(), nil); err != nil || len(users) != 0 {
		t.Fatalf("empty lookup = %+v, %v", users, err)
	}
}
