package transport

import (
	"context"
	"net/http"

	"openlobby/pkg/httpapi"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// userIDHeader carries the identity that the gateway sets after it validated the session (ADR 0002, ADR 0011).
const userIDHeader = "X-User-Id"

type userIDKey struct{}

// requireUserID answers 401 unauthenticated before the operation runs when X-User-Id is missing or not a uuid (ADR 0001).
func requireUserID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get(userIDHeader)
		if !httpapi.IsUUID(userID) {
			httpapi.WriteError(r.Context(), w, http.StatusUnauthorized, string(publicapi.ErrorBodyCodeUnauthenticated))
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userIDKey{}, userID)))
	})
}

// userIDFrom returns the user ID that requireUserID checked.
func userIDFrom(ctx context.Context) string {
	userID, _ := ctx.Value(userIDKey{}).(string)
	return userID
}
