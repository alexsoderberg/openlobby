package transport

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"openlobby/pkg/httpapi"
	"openlobby/services/gateway/internal/application"
)

// requireSession validates the session cookie with auth. Without a cookie, or with an empty one, auth is not called.
func requireSession(sessions application.SessionValidator, logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil || cookie.Value == "" {
			httpapi.WriteError(r.Context(), w, http.StatusUnauthorized, codeUnauthenticated)
			return
		}
		session, err := sessions.Validate(r.Context(), cookie.Value)
		if err != nil {
			writeSessionError(w, r, logger, err)
			return
		}
		r.Header.Set(userIDHeader, session.UserID)
		r.Header.Set(systemAdminHeader, strconv.FormatBool(session.IsSystemAdmin))
		next.ServeHTTP(w, r)
	})
}

// writeSessionError maps a failed validation to 401, 503, or 500 without details (ADR 0001).
func writeSessionError(w http.ResponseWriter, r *http.Request, logger *slog.Logger, err error) {
	switch {
	case errors.Is(err, application.ErrUnauthenticated):
		httpapi.WriteError(r.Context(), w, http.StatusUnauthorized, codeUnauthenticated)
	case errors.Is(err, application.ErrUnavailable):
		httpapi.WriteError(r.Context(), w, http.StatusServiceUnavailable, codeServiceUnavailable)
	default:
		logger.ErrorContext(r.Context(), "session validation failed", "error", err.Error())
		httpapi.WriteError(r.Context(), w, http.StatusInternalServerError, httpapi.CodeInternalError)
	}
}

// stripUserHeaders removes every X-User-* header the client sent, on every route (ADR 0002, ADR 0011).
func stripUserHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for name := range r.Header {
			if strings.HasPrefix(strings.ToLower(name), userHeaderPrefix) {
				r.Header.Del(name)
			}
		}
		next.ServeHTTP(w, r)
	})
}

// accessLog writes one line per request: method, the path without query and with masked invite tokens, status,
// duration and request ID (ADR 0002 review 4).
func accessLog(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(recorder, r)
		logger.InfoContext(r.Context(), "request",
			"method", r.Method, "path", httpapi.LogPath(r), "status", recorder.status, "duration", time.Since(start))
	})
}

// statusRecorder keeps the status code that the handler wrote. Unwrap lets the proxy flush the response.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	s.status = status
	s.ResponseWriter.WriteHeader(status)
}

func (s *statusRecorder) Unwrap() http.ResponseWriter {
	return s.ResponseWriter
}

func notFound(w http.ResponseWriter, r *http.Request) {
	httpapi.WriteError(r.Context(), w, http.StatusNotFound, codeNotFound)
}

// methodNotAllowed answers a known path with a wrong method. Allow lists the methods the path accepts.
func methodNotAllowed(allow string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Allow", allow)
		httpapi.WriteError(r.Context(), w, http.StatusMethodNotAllowed, codeMethodNotAllowed)
	}
}

// proxyErrorHandler answers a failed proxy call. A failure to connect gives 503, because nothing reached the service.
// Any other failure may have been committed, so it gives 500. The login routes redirect in both cases (ADR 0002 review 5).
// A client that went away gets no answer at all.
func proxyErrorHandler(logger *slog.Logger) func(http.ResponseWriter, *http.Request, error) {
	return func(w http.ResponseWriter, r *http.Request, err error) {
		if errors.Is(err, context.Canceled) {
			logger.DebugContext(r.Context(), "client went away", "error", err.Error())
			return
		}
		if routeFrom(r.Context()).loginRoute {
			logger.WarnContext(r.Context(), "login upstream failed", "error", err.Error())
			redirectLoginFailed(w)
			return
		}
		if isConnectFailure(err) {
			logger.WarnContext(r.Context(), "upstream unavailable", "error", err.Error())
			httpapi.WriteError(r.Context(), w, http.StatusServiceUnavailable, codeServiceUnavailable)
			return
		}
		logger.ErrorContext(r.Context(), "upstream failed", "error", err.Error())
		httpapi.WriteError(r.Context(), w, http.StatusInternalServerError, httpapi.CodeInternalError)
	}
}

// isConnectFailure reports whether the connection to the upstream could not be opened (name lookup, refused, timeout).
func isConnectFailure(err error) bool {
	var opErr *net.OpError
	return errors.As(err, &opErr) && opErr.Op == "dial"
}

func redirectLoginFailed(w http.ResponseWriter) {
	w.Header().Set(cacheControlHeader, noStore)
	w.Header().Set("Location", loginFailedTarget)
	w.WriteHeader(http.StatusFound)
}
