// Package httpapi holds the HTTP pieces shared by the services: the error envelope (ADR 0001), the body limit,
// the canonical uuid check and the generator error handlers (ADR 0012).
package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"regexp"

	"openlobby/pkg/requestid"
)

// MaxBodyBytes is the largest request body that an internal endpoint accepts (ADR 0001).
const MaxBodyBytes = 16 << 10

// CodeInvalidRequest is the code for a malformed request (ADR 0001).
const CodeInvalidRequest = "invalid_request"

// CodeInternalError is the code for an unexpected error. It never carries details (ADR 0001).
const CodeInternalError = "internal_error"

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type envelope struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code      string `json:"code"`
	RequestID string `json:"requestId"`
}

// IsUUID reports whether value has the canonical lowercase uuid form.
func IsUUID(value string) bool {
	return uuidPattern.MatchString(value)
}

// WriteError writes the error envelope with the request ID of the context. It holds no free text.
func WriteError(ctx context.Context, w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(envelope{Error: errorBody{Code: code, RequestID: requestid.FromContext(ctx)}}); err != nil {
		// The status is already written, so the failure can only be logged. The service's logger is the default one.
		slog.ErrorContext(ctx, "write error envelope", "error", err.Error())
	}
}

// InvalidRequestHandler answers a malformed request with 400 invalid_request. It is the generator's request error handler.
func InvalidRequestHandler(w http.ResponseWriter, r *http.Request, _ error) {
	WriteError(r.Context(), w, http.StatusBadRequest, CodeInvalidRequest)
}

// InternalErrorHandler logs an unexpected error with its request ID and answers 500 without details.
func InternalErrorHandler(logger *slog.Logger) func(http.ResponseWriter, *http.Request, error) {
	return func(w http.ResponseWriter, r *http.Request, err error) {
		logger.ErrorContext(r.Context(), "request failed", "error", err.Error())
		WriteError(r.Context(), w, http.StatusInternalServerError, CodeInternalError)
	}
}

// LimitBody refuses request bodies over MaxBodyBytes. The decoder then reports invalid_request.
func LimitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, MaxBodyBytes)
		next.ServeHTTP(w, r)
	})
}
