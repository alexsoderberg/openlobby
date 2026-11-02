// Package application holds the ports the gateway needs. The gateway has no domain entities: it only routes and
// validates sessions (ADR 0002).
package application

import (
	"context"
	"errors"
)

// Errors that the transport translates into status codes (ADR 0001, ADR 0002 review 5).
var (
	// ErrUnauthenticated means that auth does not know the session, or the session is expired.
	ErrUnauthenticated = errors.New("unauthenticated")
	// ErrUnavailable means that auth did not answer usably, so the request is refused (fail closed).
	ErrUnavailable = errors.New("service unavailable")
)

// Session is the identity that auth returns for a valid session. No vendor or contract type crosses this port.
type Session struct {
	UserID        string
	IsSystemAdmin bool
}

// SessionValidator asks auth whether a session token is valid (ADR 0002, ADR 0003).
type SessionValidator interface {
	Validate(ctx context.Context, sessionToken string) (Session, error)
}
