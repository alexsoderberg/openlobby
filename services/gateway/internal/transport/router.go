// Package transport routes client requests to the services, validates sessions and writes the access log (ADR 0002).
package transport

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"openlobby/pkg/health"
	"openlobby/pkg/requestid"
	"openlobby/services/gateway/internal/application"
)

// Upstreams are the base addresses of the services that the gateway routes to (ADR 0008).
type Upstreams struct {
	Auth     *url.URL
	Calendar *url.URL
	Frontend *url.URL
}

// Names of the headers and cookies that the gateway reads or sets (ADR 0002, ADR 0011).
const (
	sessionCookieName  = "ol_session"
	userIDHeader       = "X-User-Id"
	systemAdminHeader  = "X-User-System-Admin"
	userHeaderPrefix   = "x-user-"
	cookieHeaderName   = "Cookie"
	loginFailedTarget  = "/?loginError=login_failed"
	cacheControlHeader = "Cache-Control"
	noStore            = "no-store"
)

// Error codes that the gateway answers itself (ADR 0001, ADR 0002).
const (
	codeNotFound           = "not_found"
	codeMethodNotAllowed   = "method_not_allowed"
	codeUnauthenticated    = "unauthenticated"
	codeServiceUnavailable = "service_unavailable"
)

// Timeouts of the connection to an upstream (ADR 0002 review 5). A connect failure gives 503, a missing response
// header within responseHeader gives 500. responseHeader stays below edge's proxy_read_timeout of 60 seconds.
const (
	dialTimeout           = 5 * time.Second
	responseHeaderTimeout = 30 * time.Second
)

// upstreamTimeouts holds the connection timeouts. Tests use shorter ones.
type upstreamTimeouts struct {
	dial           time.Duration
	responseHeader time.Duration
}

// NewRouter returns the gateway's handler: the access log and the correlation ID around the route table.
func NewRouter(sessions application.SessionValidator, upstreams Upstreams, logger *slog.Logger) http.Handler {
	return buildRouter(sessions, upstreams, logger, upstreamTimeouts{dial: dialTimeout, responseHeader: responseHeaderTimeout})
}

func buildRouter(sessions application.SessionValidator, upstreams Upstreams, logger *slog.Logger, timeouts upstreamTimeouts) http.Handler {
	proxies := newProxies(upstreams, timeouts, logger)
	mux := http.NewServeMux()
	health.Register(mux, func(context.Context) error { return nil })
	registerRoutes(mux, routes, proxies, sessions, logger)
	mux.HandleFunc("/api", notFound)
	mux.HandleFunc("/api/", notFound)
	mux.HandleFunc("/internal/", notFound)
	return requestid.Middleware(accessLog(logger, stripUserHeaders(mux)))
}

// upstreamName identifies the service a route is passed on to.
type upstreamName string

const (
	authUpstream     upstreamName = "auth"
	calendarUpstream upstreamName = "calendar"
	frontendUpstream upstreamName = "frontend"
)

// proxies holds one reverse proxy per upstream service.
type proxies map[upstreamName]*httputil.ReverseProxy

func newProxies(upstreams Upstreams, timeouts upstreamTimeouts, logger *slog.Logger) proxies {
	transport := &http.Transport{
		DialContext:           (&net.Dialer{Timeout: timeouts.dial}).DialContext,
		ResponseHeaderTimeout: timeouts.responseHeader,
	}
	return proxies{
		// Only auth receives the session cookie (ADR 0002 review 2).
		authUpstream:     newProxy(upstreams.Auth, transport, logger, true),
		calendarUpstream: newProxy(upstreams.Calendar, transport, logger, false),
		frontendUpstream: newProxy(upstreams.Frontend, transport, logger, false),
	}
}

func newProxy(target *url.URL, transport http.RoundTripper, logger *slog.Logger, keepCookie bool) *httputil.ReverseProxy {
	return &httputil.ReverseProxy{
		Rewrite: func(out *httputil.ProxyRequest) {
			out.SetURL(target)
			out.Out.Header.Set(requestid.Header, requestid.FromContext(out.In.Context()))
			if !keepCookie {
				out.Out.Header.Del(cookieHeaderName)
			}
		},
		Transport:    transport,
		ErrorHandler: proxyErrorHandler(logger),
	}
}

// route is one row of the route table (ADR 0002 review 2): the path and method, the upstream and the access rules.
type route struct {
	method   string
	path     string
	upstream upstreamName
	// session means that a valid session is required before the request is passed on.
	session bool
	// loginRoute means that a failure to reach the upstream redirects to the login error page (ADR 0002 review 5).
	loginRoute bool
}

// routes lists every route of the public contracts (ADR 0002, amendment REQ-0001 calendar item 1).
// A path that is not in this list, or a wrong method on one, is not passed on.
var routes = []route{
	{method: http.MethodGet, path: "/api/auth/login", upstream: authUpstream, loginRoute: true},
	{method: http.MethodGet, path: "/api/auth/callback", upstream: authUpstream, loginRoute: true},
	{method: http.MethodPost, path: "/api/auth/logout", upstream: authUpstream},
	{method: http.MethodGet, path: "/api/auth/me", upstream: authUpstream, session: true},
	{method: http.MethodPost, path: "/api/groups", upstream: calendarUpstream, session: true},
	{method: http.MethodGet, path: "/api/groups", upstream: calendarUpstream, session: true},
	{method: http.MethodGet, path: "/api/groups/{groupId}", upstream: calendarUpstream, session: true},
	{method: http.MethodDelete, path: "/api/groups/{groupId}/membership", upstream: calendarUpstream, session: true},
	{method: http.MethodPut, path: "/api/groups/{groupId}/admins/{userId}", upstream: calendarUpstream, session: true},
	{method: http.MethodGet, path: "/api/groups/{groupId}/invite-links", upstream: calendarUpstream, session: true},
	{method: http.MethodPost, path: "/api/groups/{groupId}/invite-links", upstream: calendarUpstream, session: true},
	{method: http.MethodDelete, path: "/api/groups/{groupId}/invite-links/{linkId}", upstream: calendarUpstream, session: true},
	{method: http.MethodGet, path: "/api/invites/{token}", upstream: calendarUpstream, session: true},
	{method: http.MethodPost, path: "/api/invites/{token}/join", upstream: calendarUpstream, session: true},
	{method: http.MethodGet, path: "/api/games", upstream: calendarUpstream, session: true},
	{method: http.MethodPost, path: "/api/games", upstream: calendarUpstream, session: true},
	{method: http.MethodPut, path: "/api/games/{gameId}", upstream: calendarUpstream, session: true},
	{method: http.MethodDelete, path: "/api/games/{gameId}", upstream: calendarUpstream, session: true},
	{method: http.MethodGet, path: "/api/groups/{groupId}/games", upstream: calendarUpstream, session: true},
	{method: http.MethodGet, path: "/api/groups/{groupId}/lobbies", upstream: calendarUpstream, session: true},
	{method: http.MethodPost, path: "/api/groups/{groupId}/lobbies", upstream: calendarUpstream, session: true},
	{method: http.MethodGet, path: "/api/groups/{groupId}/lobbies/{lobbyId}", upstream: calendarUpstream, session: true},
	{method: http.MethodDelete, path: "/api/groups/{groupId}/lobbies/{lobbyId}", upstream: calendarUpstream, session: true},
	{method: http.MethodPut, path: "/api/groups/{groupId}/lobbies/{lobbyId}/players/me", upstream: calendarUpstream, session: true},
	{method: http.MethodDelete, path: "/api/groups/{groupId}/lobbies/{lobbyId}/players/me", upstream: calendarUpstream, session: true},
	// Every other path is the frontend, for any method (static files).
	{path: "/", upstream: frontendUpstream},
}

// registerRoutes adds each route to the mux. A known path with another method gets a JSON 405 (ADR 0002 review 2).
func registerRoutes(mux *http.ServeMux, table []route, proxies proxies, sessions application.SessionValidator, logger *slog.Logger) {
	allowed := map[string][]string{}
	for _, rt := range table {
		handler := routeHandler(sessions, logger, rt, proxies[rt.upstream])
		if rt.method == "" {
			mux.Handle(rt.path, handler)
			continue
		}
		mux.Handle(rt.method+" "+rt.path, handler)
		allowed[rt.path] = append(allowed[rt.path], rt.method)
	}
	for path, methods := range allowed {
		mux.Handle(path, methodNotAllowed(strings.Join(methods, ", ")))
	}
}

// routeHandler wraps the proxy with the route's rules. The route travels in the context for the error handler.
func routeHandler(sessions application.SessionValidator, logger *slog.Logger, rt route, proxy http.Handler) http.Handler {
	handler := proxy
	if rt.session {
		handler = requireSession(sessions, logger, handler)
	}
	return withRoute(rt, handler)
}

type routeKey struct{}

func withRoute(rt route, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), routeKey{}, rt)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func routeFrom(ctx context.Context) route {
	rt, _ := ctx.Value(routeKey{}).(route)
	return rt
}
