// Package requestid carries the correlation ID (X-Request-Id) of a request through its context (ADR 0001).
package requestid

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

// Header is the correlation ID header, passed on in every internal call.
const Header = "X-Request-Id"

// maxLength is the limit of ADR 0001 for a client-supplied ID.
const maxLength = 64

// idBytes is the random size of a generated ID (32 hex characters).
const idBytes = 16

type contextKey struct{}

// FromContext returns the request ID of the request, or "" when there is none.
func FromContext(ctx context.Context) string {
	id, _ := ctx.Value(contextKey{}).(string)
	return id
}

// Middleware keeps a valid incoming ID, generates a new one otherwise. It sets the one kept ID on the request header,
// the response header and the context, so the generated binding sees exactly one value (ADR 0001, REQ-0001 calendar).
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := validOrNew(r.Header.Values(Header))
		// The generated binding refuses two values (ADR 0001, REQ-0001 calendar), so the request holds the one kept ID.
		r.Header.Set(Header, id)
		w.Header().Set(Header, id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), contextKey{}, id)))
	})
}

// validOrNew returns the single value when it is a valid ID. Two or more values count as invalid.
func validOrNew(values []string) string {
	if len(values) == 1 && isValid(values[0]) {
		return values[0]
	}
	buf := make([]byte, idBytes)
	if _, err := rand.Read(buf); err != nil {
		// crypto/rand does not fail on supported platforms; a failure here means a broken system.
		panic("requestid: " + err.Error())
	}
	return hex.EncodeToString(buf)
}

func isValid(id string) bool {
	if id == "" || len(id) > maxLength {
		return false
	}
	for _, c := range id {
		if !isIDCharacter(c) {
			return false
		}
	}
	return true
}

func isIDCharacter(c rune) bool {
	switch {
	case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9', c == '-':
		return true
	}
	return false
}
