// Package transport maps HTTP requests to the application use cases and their results to status codes (ADR 0001).
package transport

import (
	"context"
	"errors"
	"net/http"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"openlobby/pkg/httpapi"
	"openlobby/services/auth/internal/application"
	"openlobby/services/auth/internal/domain"
)

// Names of the cookies and headers that auth reads or writes (ADR 0005, ADR 0002).
const (
	sessionCookieName = "ol_session"
	loginCookieName   = "ol_login"
	userIDHeader      = "X-User-Id"
	loginCookiePath   = "/api/auth/callback"
)

type credentialsKey struct{}

// credentials are the inputs of the authenticated endpoints: the session cookie, and the user ID that the gateway
// sets after it validated the session. Internal services never trust identity from the client (ADR 0002).
type credentials struct {
	sessionToken string
	userID       string
}

// withCredentials reads the session cookie and a valid X-User-Id into the context.
func withCredentials(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var found credentials
		if cookie, err := r.Cookie(sessionCookieName); err == nil {
			found.sessionToken = cookie.Value
		}
		if id := r.Header.Get(userIDHeader); httpapi.IsUUID(id) {
			found.userID = id
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), credentialsKey{}, found)))
	})
}

func credentialsFrom(ctx context.Context) credentials {
	found, _ := ctx.Value(credentialsKey{}).(credentials)
	return found
}

// isUnavailable reports whether a dependency did not answer, which gives 503 (ADR 0001).
func isUnavailable(err error) bool {
	return errors.Is(err, domain.ErrUnavailable)
}

// isUnauthenticated reports whether there is no valid session or user, which gives 401.
func isUnauthenticated(err error) bool {
	return errors.Is(err, application.ErrUnauthenticated)
}

// parseUUID converts a validated uuid string into the type that the generated code uses.
func parseUUID(value string) (openapi_types.UUID, error) {
	var id openapi_types.UUID
	err := id.UnmarshalText([]byte(value))
	return id, err
}
