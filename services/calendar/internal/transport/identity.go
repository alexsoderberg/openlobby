package transport

import (
	"context"
	"net/http"

	"openlobby/pkg/httpapi"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// userIDHeader and systemAdminHeader carry the identity that the gateway sets after it validated the session (ADR 0002, ADR 0011).
const (
	userIDHeader      = "X-User-Id"
	systemAdminHeader = "X-User-System-Admin"
	// systemAdminValue is the only value that makes the caller a system admin. Any other value is a normal user (ADR 0011).
	systemAdminValue = "true"
)

type actorKey struct{}

// requireUserID answers 401 unauthenticated before the operation runs when X-User-Id is missing or not a uuid (ADR 0001).
// Otherwise it puts the caller, with the system admin flag, into the context.
func requireUserID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get(userIDHeader)
		if !httpapi.IsUUID(userID) {
			httpapi.WriteError(r.Context(), w, http.StatusUnauthorized, string(publicapi.ErrorBodyCodeUnauthenticated))
			return
		}
		actor := domain.Actor{UserID: userID, IsSystemAdmin: r.Header.Get(systemAdminHeader) == systemAdminValue}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), actorKey{}, actor)))
	})
}

// actorFrom returns the caller that requireUserID checked.
func actorFrom(ctx context.Context) domain.Actor {
	actor, _ := ctx.Value(actorKey{}).(domain.Actor)
	return actor
}

// userIDFrom returns the user ID that requireUserID checked.
func userIDFrom(ctx context.Context) string {
	return actorFrom(ctx).UserID
}
