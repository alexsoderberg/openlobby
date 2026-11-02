package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLogPath(t *testing.T) {
	tests := []struct {
		name   string
		method string
		target string
		want   string
	}{
		{"query string is dropped", http.MethodGet, "/api/auth/callback?code=A&state=B", "/api/auth/callback"},
		{"invite join masks the token and drops the query", http.MethodPost, "/api/invites/TOKEN/join?x=1", "/api/invites/:token/join"},
		{"invite page masks the token", http.MethodGet, "/invite/TOKEN", "/invite/:token"},
		{"invite lookup masks the token", http.MethodGet, "/api/invites/TOKEN", "/api/invites/:token"},
		{"invite prefix without a token is kept", http.MethodGet, "/api/invites", "/api/invites"},
		{"encoded prefix segment is masked", http.MethodPost, "/api/%69nvites/TOKEN/join", "/api/invites/:token/join"},
		{"empty segment before the token is masked", http.MethodPost, "/api/invites//TOKEN/join", "/api/invites/:token/join"},
		{"empty segment on the page is masked", http.MethodGet, "/invite//TOKEN", "/invite/:token"},
		{"upper case prefix is masked", http.MethodPost, "/INVITE/TOKEN", "/invite/:token"},
		{"dot segments are resolved before masking", http.MethodPost, "/api/groups/x/../../invites/TOKEN/join", "/api/invites/:token/join"},
		{"trailing slash is masked", http.MethodGet, "/api/invites/TOKEN/", "/api/invites/:token"},
		{"semicolon inside the token is masked", http.MethodPost, "/api/invites/TOKEN;x/join", "/api/invites/:token/join"},
		{"encoded slash inside the token hides the rest", http.MethodPost, "/api/invites/a%2Fb/join", "/api/invites/:token"},
		{"upper case encoded slash inside the token hides the rest", http.MethodPost, "/api/invites/a%2fb/join", "/api/invites/:token"},
		{"other suffix after the token is dropped", http.MethodPost, "/api/invites/TOKEN/other", "/api/invites/:token"},
		{"other paths are kept", http.MethodGet, "/api/groups/123/lobbies", "/api/groups/123/lobbies"},
		{"root is kept", http.MethodGet, "/", "/"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(test.method, test.target, nil)
			if got := LogPath(request); got != test.want {
				t.Errorf("LogPath(%q) = %q, want %q", test.target, got, test.want)
			}
		})
	}
}
