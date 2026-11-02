// Package application holds the use cases of the auth service and the ports they need (ADR 0003, 0005).
package application

import (
	"context"
	"errors"
	"time"

	"openlobby/services/auth/internal/domain"
)

// Errors that the transport translates into status codes and redirects (ADR 0001, ADR 0005).
var (
	// ErrUnauthenticated means that there is no valid session or user.
	ErrUnauthenticated = errors.New("unauthenticated")
	// ErrLoginDenied means that the user refused at the provider.
	ErrLoginDenied = errors.New("login denied")
	// ErrLoginFailed means that the login did not succeed for any other reason.
	ErrLoginFailed = errors.New("login failed")
	// ErrIdentityProvider means that the identity provider rejected the code or did not answer usably.
	ErrIdentityProvider = errors.New("identity provider failed")
)

// IdentityProvider is the port to the external login provider (ADR 0005). Adapters hold the vendor details.
type IdentityProvider interface {
	AuthorizationURL(state, codeChallenge string) string
	Exchange(ctx context.Context, code, codeVerifier string) (ExternalIdentity, error)
}

// ExternalIdentity is what the provider tells us about the user. No vendor type crosses this port.
type ExternalIdentity struct {
	Provider    string
	SubjectID   string
	DisplayName string
}

// UserRepository stores member accounts.
type UserRepository interface {
	// Upsert creates the user of the identity, or updates its display name (ADR 0005, step 6).
	Upsert(ctx context.Context, identity ExternalIdentity) (domain.User, error)
	FindByID(ctx context.Context, userID string) (domain.User, error)
	FindByIDs(ctx context.Context, userIDs []string) ([]domain.User, error)
}

// SessionRepository stores sessions by the hash of their token.
type SessionRepository interface {
	Insert(ctx context.Context, tokenHash []byte, userID string, expiresAt time.Time) error
	Find(ctx context.Context, tokenHash []byte) (domain.Session, error)
	Delete(ctx context.Context, tokenHash []byte) error
	DeleteExpired(ctx context.Context, now time.Time) error
}

// LoginAttempt is a login that is waiting for the provider's callback.
type LoginAttempt struct {
	CodeVerifier string
	ReturnTo     string
}

// LoginAttemptRepository stores login attempts by the hash of their state.
type LoginAttemptRepository interface {
	Insert(ctx context.Context, stateHash []byte, codeVerifier, returnTo string, expiresAt time.Time) error
	// Consume deletes and returns the attempt in one step. It gives domain.ErrNotFound when the attempt is unknown,
	// expired or already used (ADR 0005, step 4).
	Consume(ctx context.Context, stateHash []byte, now time.Time) (LoginAttempt, error)
	DeleteExpired(ctx context.Context, now time.Time) error
}

// Transactor runs the function in one database transaction. The adapter decides how (ADR 0005, step 6).
type Transactor interface {
	InTx(ctx context.Context, fn func(ctx context.Context) error) error
}

// Clock gives the current time. Tests control it.
type Clock interface {
	Now() time.Time
}

// TokenGenerator returns a random, URL-safe secret of 32 bytes (state, PKCE verifier, session token).
type TokenGenerator interface {
	NewToken() (string, error)
}
