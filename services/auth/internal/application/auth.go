package application

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"openlobby/services/auth/internal/domain"
)

// MaxLookupUserIDs is the most user IDs one lookup accepts (ADR 0003). Calendar splits larger lists.
const MaxLookupUserIDs = 100

// providerAccessDenied is the error value that the provider sends when the user refuses (ADR 0005).
const providerAccessDenied = "access_denied"

// Ports are the dependencies of Auth. They are wired in cmd/auth/main.go.
type Ports struct {
	Identity IdentityProvider
	Users    UserRepository
	Sessions SessionRepository
	Attempts LoginAttemptRepository
	Tx       Transactor
	Clock    Clock
	Tokens   TokenGenerator
	Admins   domain.SystemAdmins
}

// Auth holds the use cases of the auth service: login, sessions, the current user and the user lookup.
type Auth struct {
	ports  Ports
	logger *slog.Logger
}

// NewAuth returns the use cases with their dependencies.
func NewAuth(ports Ports, logger *slog.Logger) *Auth {
	return &Auth{ports: ports, logger: logger}
}

// LoginStart is the result of starting a login: the provider's URL and the state that binds the browser.
type LoginStart struct {
	AuthorizationURL string
	State            string
}

// StartLogin creates a login attempt and returns the provider's authorization URL (ADR 0005, step 1).
func (a *Auth) StartLogin(ctx context.Context, returnTo string) (LoginStart, error) {
	state, err := a.ports.Tokens.NewToken()
	if err != nil {
		return LoginStart{}, fmt.Errorf("new state: %w", err)
	}
	verifier, err := a.ports.Tokens.NewToken()
	if err != nil {
		return LoginStart{}, fmt.Errorf("new code verifier: %w", err)
	}
	now := a.ports.Clock.Now()
	err = a.ports.Tx.InTx(ctx, func(ctx context.Context) error {
		if err := a.ports.Attempts.DeleteExpired(ctx, now); err != nil {
			return err
		}
		return a.ports.Attempts.Insert(ctx, hashSecret(state), verifier, domain.SafeReturnTo(returnTo),
			now.Add(domain.LoginAttemptLifetime))
	})
	if err != nil {
		return LoginStart{}, fmt.Errorf("store login attempt: %w", err)
	}
	return LoginStart{
		AuthorizationURL: a.ports.Identity.AuthorizationURL(state, pkceChallenge(verifier)),
		State:            state,
	}, nil
}

// LoginCallback holds the parameters of the provider's redirect and the binding cookie of the browser.
type LoginCallback struct {
	Code          string
	State         string
	ProviderError string
	CookieState   string
}

// LoginResult is a successful login: the new session token and the path to return to.
type LoginResult struct {
	SessionToken string
	ReturnTo     string
}

// CompleteLogin checks the callback, exchanges the code, creates or updates the user and creates a session
// (ADR 0005, callback steps 1 to 7). Every failure gives ErrLoginFailed, except a denied login.
func (a *Auth) CompleteLogin(ctx context.Context, callback LoginCallback) (LoginResult, error) {
	if callback.ProviderError == providerAccessDenied {
		a.logger.InfoContext(ctx, "login denied at provider")
		return LoginResult{}, ErrLoginDenied
	}
	if problem := callbackProblem(callback); problem != "" {
		return a.loginFailed(ctx, problem, nil)
	}
	now := a.ports.Clock.Now()
	attempt, err := a.ports.Attempts.Consume(ctx, hashSecret(callback.State), now)
	if err != nil {
		return a.loginFailed(ctx, "attempt not usable", err)
	}
	identity, err := a.ports.Identity.Exchange(ctx, callback.Code, attempt.CodeVerifier)
	if err != nil {
		return a.loginFailed(ctx, "provider exchange", err)
	}
	token, err := a.ports.Tokens.NewToken()
	if err != nil {
		return a.loginFailed(ctx, "new session token", err)
	}
	user, err := a.storeLogin(ctx, identity, token, now)
	if err != nil {
		return a.loginFailed(ctx, "store login", err)
	}
	a.logger.InfoContext(ctx, "login succeeded", "userId", user.ID)
	return LoginResult{SessionToken: token, ReturnTo: domain.SafeReturnTo(attempt.ReturnTo)}, nil
}

// callbackProblem names why the callback cannot be used, or returns "" (ADR 0005, steps 1 to 3). The binding check
// runs before any database access, so a forged callback leaves the attempt untouched.
func callbackProblem(callback LoginCallback) string {
	switch {
	case callback.ProviderError != "":
		return "provider error"
	case callback.Code == "" || callback.State == "":
		return "missing parameter"
	case subtle.ConstantTimeCompare([]byte(callback.State), []byte(callback.CookieState)) != 1:
		return "binding cookie mismatch"
	}
	return ""
}

// storeLogin creates or updates the user and creates the session in one transaction (ADR 0005, step 6).
func (a *Auth) storeLogin(ctx context.Context, identity ExternalIdentity, token string, now time.Time) (domain.User, error) {
	var user domain.User
	err := a.ports.Tx.InTx(ctx, func(ctx context.Context) error {
		var err error
		if user, err = a.ports.Users.Upsert(ctx, identity); err != nil {
			return err
		}
		if err := a.ports.Sessions.DeleteExpired(ctx, now); err != nil {
			return err
		}
		return a.ports.Sessions.Insert(ctx, hashSecret(token), user.ID, domain.SessionExpiry(now))
	})
	return user, err
}

func (a *Auth) loginFailed(ctx context.Context, reason string, cause error) (LoginResult, error) {
	attrs := []any{"reason", reason}
	if cause != nil {
		attrs = append(attrs, "error", cause.Error())
	}
	a.logger.WarnContext(ctx, "login failed", attrs...)
	return LoginResult{}, ErrLoginFailed
}

// Logout deletes the session. An empty or unknown token is not an error, so logout is idempotent (ADR 0005).
func (a *Auth) Logout(ctx context.Context, sessionToken string) error {
	if sessionToken == "" {
		return nil
	}
	if err := a.ports.Sessions.Delete(ctx, hashSecret(sessionToken)); err != nil {
		return fmt.Errorf("delete session: %w", err)
	}
	a.logger.InfoContext(ctx, "logout")
	return nil
}

// Account is an authenticated user with the system admin role decided from configuration (ADR 0011).
type Account struct {
	UserID        string
	DisplayName   string
	IsSystemAdmin bool
}

// ValidateSession returns the account of a valid session. An empty, unknown or expired token gives ErrUnauthenticated.
func (a *Auth) ValidateSession(ctx context.Context, sessionToken string) (Account, error) {
	if sessionToken == "" {
		return Account{}, ErrUnauthenticated
	}
	session, err := a.ports.Sessions.Find(ctx, hashSecret(sessionToken))
	if errors.Is(err, domain.ErrNotFound) {
		return Account{}, ErrUnauthenticated
	}
	if err != nil {
		return Account{}, fmt.Errorf("find session: %w", err)
	}
	if !session.ActiveAt(a.ports.Clock.Now()) {
		return Account{}, ErrUnauthenticated
	}
	return a.CurrentUser(ctx, session.UserID)
}

// CurrentUser returns the account of a user. A user that does not exist gives ErrUnauthenticated.
func (a *Auth) CurrentUser(ctx context.Context, userID string) (Account, error) {
	user, err := a.ports.Users.FindByID(ctx, userID)
	if errors.Is(err, domain.ErrNotFound) {
		return Account{}, ErrUnauthenticated
	}
	if err != nil {
		return Account{}, fmt.Errorf("find user: %w", err)
	}
	return Account{UserID: user.ID, DisplayName: user.DisplayName, IsSystemAdmin: a.ports.Admins.Includes(user)}, nil
}

// LookupUsers returns the users among userIDs. Unknown IDs are left out (ADR 0003).
func (a *Auth) LookupUsers(ctx context.Context, userIDs []string) ([]domain.User, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}
	users, err := a.ports.Users.FindByIDs(ctx, userIDs)
	if err != nil {
		return nil, fmt.Errorf("find users: %w", err)
	}
	return users, nil
}
