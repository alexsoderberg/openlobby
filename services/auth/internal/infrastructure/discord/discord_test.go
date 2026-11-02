package discord

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"openlobby/services/auth/internal/application"
)

// fakeDiscord stands in for Discord's token and user endpoints. Discord is never called in CI (ADR 0005).
type fakeDiscord struct {
	t           *testing.T
	tokenStatus int
	tokenBody   string
	userStatus  int
	userBody    string
	gotVerifier string
	gotBearer   string
}

// write sends a body and fails the test if the response cannot be written.
func (f *fakeDiscord) write(w http.ResponseWriter, body string) {
	if _, err := io.WriteString(w, body); err != nil {
		f.t.Errorf("write fake response: %v", err)
	}
}

func (f *fakeDiscord) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad form", http.StatusBadRequest)
			return
		}
		f.gotVerifier = r.PostForm.Get("code_verifier")
		if f.tokenStatus != http.StatusOK {
			w.WriteHeader(f.tokenStatus)
			f.write(w, f.tokenBody)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		f.write(w, `{"access_token":"access-token","token_type":"Bearer","expires_in":3600}`)
	})
	mux.HandleFunc("/user", func(w http.ResponseWriter, r *http.Request) {
		f.gotBearer = r.Header.Get("Authorization")
		w.WriteHeader(f.userStatus)
		f.write(w, f.userBody)
	})
	return mux
}

func newTestAdapter(t *testing.T, fake *fakeDiscord) *Adapter {
	t.Helper()
	fake.t = t
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)
	urls := endpoints{
		authorize: server.URL + "/authorize",
		token:     server.URL + "/token",
		user:      server.URL + "/user",
	}
	return newWithEndpoints(Config{ClientID: "id", ClientSecret: "secret", RedirectURI: "https://localhost/cb"},
		urls, server.Client())
}

func TestAuthorizationURLRequestsIdentifyWithS256(t *testing.T) {
	adapter := newTestAdapter(t, &fakeDiscord{})
	raw := adapter.AuthorizationURL("state-1", "challenge-1")

	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	query := parsed.Query()
	if query.Get("scope") != "identify" || query.Get("state") != "state-1" ||
		query.Get("code_challenge") != "challenge-1" || query.Get("code_challenge_method") != "S256" {
		t.Fatalf("unexpected authorization URL %q", raw)
	}
}

func TestExchangeReturnsIdentityAndSendsVerifier(t *testing.T) {
	fake := &fakeDiscord{
		tokenStatus: http.StatusOK,
		userStatus:  http.StatusOK,
		userBody:    `{"id":"111","username":"alex","global_name":"Alex S"}`,
	}
	identity, err := newTestAdapter(t, fake).Exchange(context.Background(), "code-1", "verifier-1")
	if err != nil {
		t.Fatalf("Exchange: %v", err)
	}
	want := application.ExternalIdentity{Provider: "discord", SubjectID: "111", DisplayName: "Alex S"}
	if identity != want {
		t.Fatalf("identity = %+v, want %+v", identity, want)
	}
	if fake.gotVerifier != "verifier-1" {
		t.Fatalf("provider received verifier %q", fake.gotVerifier)
	}
	if fake.gotBearer != "Bearer access-token" {
		t.Fatalf("user request sent %q", fake.gotBearer)
	}
}

func TestDisplayNameFallsBackToUsername(t *testing.T) {
	fake := &fakeDiscord{tokenStatus: http.StatusOK, userStatus: http.StatusOK,
		userBody: `{"id":"111","username":"alex","global_name":null}`}
	identity, err := newTestAdapter(t, fake).Exchange(context.Background(), "c", "v")
	if err != nil {
		t.Fatal(err)
	}
	if identity.DisplayName != "alex" {
		t.Fatalf("display name %q, want the username", identity.DisplayName)
	}
}

func TestProviderFailuresDoNotLeakProviderText(t *testing.T) {
	const marker = "SECRET-PROVIDER-BODY"
	tests := []struct {
		name string
		fake *fakeDiscord
	}{
		{name: "token rejected", fake: &fakeDiscord{tokenStatus: http.StatusBadRequest, tokenBody: marker}},
		{name: "user request fails", fake: &fakeDiscord{tokenStatus: http.StatusOK, userStatus: http.StatusInternalServerError, userBody: marker}},
		{name: "user without id", fake: &fakeDiscord{tokenStatus: http.StatusOK, userStatus: http.StatusOK, userBody: `{"username":"x"}`}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, err := newTestAdapter(t, tc.fake).Exchange(context.Background(), "c", "v")
			if !errors.Is(err, application.ErrIdentityProvider) {
				t.Fatalf("err = %v, want ErrIdentityProvider", err)
			}
			if strings.Contains(err.Error(), marker) {
				t.Fatalf("error text leaks the provider body: %q", err)
			}
		})
	}
}
