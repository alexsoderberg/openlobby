package transport

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"openlobby/pkg/httpapi"
	"openlobby/pkg/requestid"
	"openlobby/services/auth/internal/application"
	"openlobby/services/auth/internal/domain"
	publicapi "openlobby/services/auth/internal/transport/gen/publicapi"
)

// Login paths and the redirect targets of the login flow (ADR 0005). Login never answers with JSON.
const (
	loginPath         = "/api/auth/login"
	callbackPath      = "/api/auth/callback"
	loginFailedTarget = "/?loginError=login_failed"
	loginDeniedTarget = "/?loginError=login_denied"
	// cookieDeleted is a MaxAge below zero, which makes net/http write Max-Age=0 (deletes the cookie).
	cookieDeleted = -1
)

// Cookie lifetimes in seconds: the login attempt (ADR 0005) and the session of 30 days (ADR 0005).
var (
	loginCookieMaxAge = int(domain.LoginAttemptLifetime.Seconds())
	sessionCookieAge  = int(domain.SessionLifetime.Seconds())
)

// publicHandler implements the public endpoints of the OpenAPI contract.
type publicHandler struct {
	auth   *application.Auth
	logger *slog.Logger
}

var _ publicapi.StrictServerInterface = publicHandler{}

// StartLogin redirects to the provider and binds the browser with the ol_login cookie (ADR 0005, step 1).
// Every failure is a redirect to the login error page, without the cookie.
func (h publicHandler) StartLogin(ctx context.Context, request publicapi.StartLoginRequestObject) (publicapi.StartLoginResponseObject, error) {
	returnTo := ""
	if request.Params.ReturnTo != nil {
		returnTo = *request.Params.ReturnTo
	}
	started, err := h.auth.StartLogin(ctx, returnTo)
	if err != nil {
		h.logger.ErrorContext(ctx, "start login failed", "error", err.Error())
		return loginRedirect{location: loginFailedTarget}, nil
	}
	return loginRedirect{
		location: started.AuthorizationURL,
		cookies:  []*http.Cookie{loginBindingCookie(started.State)},
	}, nil
}

// CompleteLogin receives the provider's redirect. It always redirects and always clears ol_login (ADR 0005).
func (h publicHandler) CompleteLogin(ctx context.Context, request publicapi.CompleteLoginRequestObject) (publicapi.CompleteLoginResponseObject, error) {
	params := request.Params
	result, err := h.auth.CompleteLogin(ctx, application.LoginCallback{
		Code:          derefString(params.Code),
		State:         derefString(params.State),
		ProviderError: derefString(params.Error),
		CookieState:   derefString(params.OlLogin),
	})
	clearLogin := clearCookie(loginCookieName, loginCookiePath)
	switch {
	case errors.Is(err, application.ErrLoginDenied):
		return loginRedirect{location: loginDeniedTarget, cookies: []*http.Cookie{clearLogin}}, nil
	case err != nil:
		return loginRedirect{location: loginFailedTarget, cookies: []*http.Cookie{clearLogin}}, nil
	}
	session := &http.Cookie{
		Name:     sessionCookieName,
		Value:    result.SessionToken,
		Path:     "/",
		MaxAge:   sessionCookieAge,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	}
	return loginRedirect{location: result.ReturnTo, cookies: []*http.Cookie{session, clearLogin}}, nil
}

// Logout deletes the session and clears the cookie. It is idempotent, and 503 when the database does not answer.
func (h publicHandler) Logout(ctx context.Context, _ publicapi.LogoutRequestObject) (publicapi.LogoutResponseObject, error) {
	if err := h.auth.Logout(ctx, credentialsFrom(ctx).sessionToken); err != nil {
		if !isUnavailable(err) {
			return nil, err
		}
		h.logger.ErrorContext(ctx, "logout failed", "error", err.Error())
		return publicapi.Logout503JSONResponse{ServiceUnavailableJSONResponse: publicapi.ServiceUnavailableJSONResponse{
			Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeServiceUnavailable),
		}}, nil
	}
	cleared := clearCookie(sessionCookieName, "/").String()
	return publicapi.Logout204Response{Headers: publicapi.Logout204ResponseHeaders{SetCookie: &cleared}}, nil
}

// GetCurrentUser returns the logged-in user. The gateway set X-User-Id after it validated the session.
func (h publicHandler) GetCurrentUser(ctx context.Context, _ publicapi.GetCurrentUserRequestObject) (publicapi.GetCurrentUserResponseObject, error) {
	userID := credentialsFrom(ctx).userID
	if userID == "" {
		return publicapi.GetCurrentUser401JSONResponse{UnauthenticatedJSONResponse: publicapi.UnauthenticatedJSONResponse{
			Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeUnauthenticated),
		}}, nil
	}
	account, err := h.auth.CurrentUser(ctx, userID)
	switch {
	case isUnauthenticated(err):
		return publicapi.GetCurrentUser401JSONResponse{UnauthenticatedJSONResponse: publicapi.UnauthenticatedJSONResponse{
			Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeUnauthenticated),
		}}, nil
	case isUnavailable(err):
		return publicapi.GetCurrentUser503JSONResponse{ServiceUnavailableJSONResponse: publicapi.ServiceUnavailableJSONResponse{
			Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeServiceUnavailable),
		}}, nil
	case err != nil:
		return nil, err
	}
	id, err := parseUUID(account.UserID)
	if err != nil {
		return nil, err
	}
	return publicapi.GetCurrentUser200JSONResponse{
		UserId:        id,
		DisplayName:   account.DisplayName,
		IsSystemAdmin: account.IsSystemAdmin,
	}, nil
}

func publicErrorBody(ctx context.Context, code publicapi.ErrorBodyCode) publicapi.ErrorBody {
	return publicapi.ErrorBody{Code: code, RequestId: requestid.FromContext(ctx)}
}

// publicBindingErrorHandler answers a parameter that the generated binding refused (for example two state values).
// The login paths redirect, so a browser never sees JSON there (ADR 0005, review 5).
func publicBindingErrorHandler(w http.ResponseWriter, r *http.Request, err error) {
	switch r.URL.Path {
	case loginPath:
		loginRedirect{location: loginFailedTarget}.write(w)
	case callbackPath:
		loginRedirect{location: loginFailedTarget, cookies: []*http.Cookie{clearCookie(loginCookieName, loginCookiePath)}}.write(w)
	default:
		httpapi.InvalidRequestHandler(w, r, err)
	}
}

// loginRedirect is a 302 response of the login flow. It sets no-store, because it may set cookies (ADR 0005).
type loginRedirect struct {
	location string
	cookies  []*http.Cookie
}

// VisitStartLoginResponse writes the redirect of GET /api/auth/login.
func (r loginRedirect) VisitStartLoginResponse(w http.ResponseWriter) error {
	r.write(w)
	return nil
}

// VisitCompleteLoginResponse writes the redirect of GET /api/auth/callback. It sets two cookies, which the generated
// response type cannot do (ADR 0012, review 5).
func (r loginRedirect) VisitCompleteLoginResponse(w http.ResponseWriter) error {
	r.write(w)
	return nil
}

func (r loginRedirect) write(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store")
	for _, cookie := range r.cookies {
		http.SetCookie(w, cookie)
	}
	w.Header().Set("Location", r.location)
	w.WriteHeader(http.StatusFound)
}

// loginBindingCookie binds the attempt to this browser. Its value is the state, and it lives as long as the attempt
// (ADR 0005, amendment review 5).
func loginBindingCookie(state string) *http.Cookie {
	return &http.Cookie{
		Name:     loginCookieName,
		Value:    state,
		Path:     loginCookiePath,
		MaxAge:   loginCookieMaxAge,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	}
}

func clearCookie(name, path string) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Path:     path,
		MaxAge:   cookieDeleted,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	}
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
