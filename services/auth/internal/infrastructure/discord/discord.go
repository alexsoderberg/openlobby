// Package discord implements application.IdentityProvider for Discord OAuth2 (ADR 0005). Discord types and URLs
// stay in this package.
package discord

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"

	"openlobby/services/auth/internal/application"
)

// ProviderName is the value of users.provider for Discord users (ADR 0005).
const ProviderName = "discord"

// scope is the smallest scope that identifies the user (ADR 0005).
const scope = "identify"

// maxUserResponseBytes bounds the user object that Discord returns. A real one is far smaller (CLAUDE.md, input
// validation at the boundary).
const maxUserResponseBytes = 64 << 10

// requestTimeout bounds every call to Discord. A timeout counts as a failed login (ADR 0005).
const requestTimeout = 10 * time.Second

const (
	authorizeURL = "https://discord.com/oauth2/authorize"
	tokenURL     = "https://discord.com/api/oauth2/token"
	userURL      = "https://discord.com/api/users/@me"
)

// Config holds the Discord application settings from the environment (ADR 0005).
type Config struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
}

// Adapter is the Discord implementation of the identity provider port.
type Adapter struct {
	oauth   *oauth2.Config
	client  *http.Client
	userURL string
}

// New returns the adapter for production Discord endpoints.
func New(config Config) *Adapter {
	endpoints := endpoints{authorize: authorizeURL, token: tokenURL, user: userURL}
	return newWithEndpoints(config, endpoints, &http.Client{Timeout: requestTimeout})
}

type endpoints struct {
	authorize, token, user string
}

func newWithEndpoints(config Config, urls endpoints, client *http.Client) *Adapter {
	return &Adapter{
		oauth: &oauth2.Config{
			ClientID:     config.ClientID,
			ClientSecret: config.ClientSecret,
			RedirectURL:  config.RedirectURI,
			Scopes:       []string{scope},
			Endpoint:     oauth2.Endpoint{AuthURL: urls.authorize, TokenURL: urls.token},
		},
		client:  client,
		userURL: urls.user,
	}
}

// AuthorizationURL returns Discord's authorize URL with the PKCE challenge (S256).
func (a *Adapter) AuthorizationURL(state, codeChallenge string) string {
	return a.oauth.AuthCodeURL(state,
		oauth2.SetAuthURLParam("code_challenge", codeChallenge),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
	)
}

// Exchange trades the code for a token and reads the user. Every failure gives application.ErrIdentityProvider
// without the provider's text, because that text can contain secrets.
func (a *Adapter) Exchange(ctx context.Context, code, codeVerifier string) (application.ExternalIdentity, error) {
	ctx = context.WithValue(ctx, oauth2.HTTPClient, a.client)
	token, err := a.oauth.Exchange(ctx, code, oauth2.VerifierOption(codeVerifier))
	if err != nil {
		return application.ExternalIdentity{}, fmt.Errorf("exchange code: %w", application.ErrIdentityProvider)
	}
	user, err := a.fetchUser(ctx, token)
	if err != nil {
		return application.ExternalIdentity{}, err
	}
	return application.ExternalIdentity{Provider: ProviderName, SubjectID: user.ID, DisplayName: user.displayName()}, nil
}

// discordUser is the part of Discord's user object that the service uses.
type discordUser struct {
	ID         string `json:"id"`
	Username   string `json:"username"`
	GlobalName string `json:"global_name"`
}

// displayName is the global name when Discord has one, otherwise the username (ADR 0005).
func (u discordUser) displayName() string {
	if u.GlobalName != "" {
		return u.GlobalName
	}
	return u.Username
}

func (a *Adapter) fetchUser(ctx context.Context, token *oauth2.Token) (user discordUser, err error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, a.userURL, nil)
	if err != nil {
		return discordUser{}, fmt.Errorf("build user request: %w", err)
	}
	token.SetAuthHeader(request)
	response, err := a.client.Do(request)
	if err != nil {
		return discordUser{}, fmt.Errorf("fetch user: %w", application.ErrIdentityProvider)
	}
	defer func() { err = errors.Join(err, response.Body.Close()) }()
	if response.StatusCode != http.StatusOK {
		return discordUser{}, fmt.Errorf("fetch user status %d: %w", response.StatusCode, application.ErrIdentityProvider)
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, maxUserResponseBytes)).Decode(&user); err != nil {
		return discordUser{}, fmt.Errorf("decode user: %w", application.ErrIdentityProvider)
	}
	if user.ID == "" {
		return discordUser{}, fmt.Errorf("user response has no id: %w", application.ErrIdentityProvider)
	}
	return user, nil
}
