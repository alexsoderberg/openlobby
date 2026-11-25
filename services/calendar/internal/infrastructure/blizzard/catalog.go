// Package blizzard implements application.ItemCatalog on Blizzard's Game Data API (ADR 0029 section 4). It is the only
// package that knows Blizzard's hosts, paths and answers. Standard library only: the client credentials flow is one POST.
package blizzard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// The token URL, the API host and paths, and the asset host were checked against the real API on 2026-11-25.
const (
	tokenHost     = "oauth.battle.net"
	iconAssetHost = "render.worldofwarcraft.com"
	// locale is pinned: item names stay English (REQ-0030).
	locale = "en_US"

	catalogRequestTimeout    = 3 * time.Second
	maxCatalogCallsPerSecond = 3
	catalogBackoff           = 60 * time.Second
	// maxConsecutiveNotFound guards against a namespace that no longer exists, which Blizzard answers with 404 for
	// every item. shortcut: a streak instead of a namespace probe; upgrade if the warning is seen with a healthy namespace.
	maxConsecutiveNotFound = 10
	// tokenRenewMargin renews the token this long before Blizzard's expiry.
	tokenRenewMargin = 60 * time.Second
	// maxAnswerBytes bounds the JSON read of one answer; an item or media answer is a few KiB.
	maxAnswerBytes = 1 << 20
	maxRedirects   = 10

	secureScheme     = "https"
	iconAssetKey     = "icon"
	jpegMediaType    = "image/jpeg"
	pngMediaType     = "image/png"
	clientCredential = "client_credentials"
)

// regions are the API regions the configuration may name (ADR 0029 section 4).
var regions = []string{"us", "eu", "kr", "tw"}

var errRedirectRefused = errors.New("redirect refused")

// Config is the configuration of the catalog, read from the environment by main.
type Config struct {
	ClientID     string
	ClientSecret string
	Region       string
	Namespace    string
}

// Catalog is the Blizzard item catalog. Calls are rate limited, and paused after a 429 or 5xx answer.
type Catalog struct {
	client       *http.Client
	tokenURL     string
	apiBaseURL   string
	allowedHosts []string
	config       Config
	logger       *slog.Logger
	clock        application.Clock
	// callTicks is never stopped: the catalog lives as long as the process.
	callTicks <-chan time.Time

	mu             sync.Mutex
	token          string
	tokenExpiry    time.Time
	pausedUntil    time.Time
	notFoundStreak int
}

var _ application.ItemCatalog = (*Catalog)(nil)

// New returns the catalog for the configured region, or an error when the region is not one of us, eu, kr, tw.
func New(config Config, clock application.Clock, logger *slog.Logger) (*Catalog, error) {
	if !slices.Contains(regions, config.Region) {
		return nil, fmt.Errorf("region must be one of %s", strings.Join(regions, ", "))
	}
	apiHost := config.Region + ".api.blizzard.com"
	return newCatalog(config, secureScheme+"://"+tokenHost+"/token", secureScheme+"://"+apiHost, []string{tokenHost, apiHost, iconAssetHost},
		time.Second/maxCatalogCallsPerSecond, clock, logger), nil
}

// newCatalog takes the hosts and the call interval, so the tests can point it at their own servers.
func newCatalog(config Config, tokenURL, apiBaseURL string, allowedHosts []string, callInterval time.Duration, clock application.Clock, logger *slog.Logger) *Catalog {
	c := &Catalog{tokenURL: tokenURL, apiBaseURL: apiBaseURL, allowedHosts: allowedHosts, config: config, logger: logger, clock: clock,
		callTicks: time.NewTicker(callInterval).C}
	c.client = &http.Client{Timeout: catalogRequestTimeout, CheckRedirect: func(request *http.Request, via []*http.Request) error {
		if len(via) >= maxRedirects || !c.isAllowed(request.URL) {
			return errRedirectRefused
		}
		return nil
	}}
	return c
}

// Item returns the English name of the item.
func (c *Catalog) Item(ctx context.Context, itemID domain.ItemID) (domain.CatalogItem, error) {
	var answer struct {
		Name string `json:"name"`
	}
	if err := c.getJSON(ctx, "/data/wow/item/"+strconv.Itoa(int(itemID)), &answer); err != nil {
		return domain.CatalogItem{}, err
	}
	if answer.Name == "" {
		return domain.CatalogItem{}, fmt.Errorf("item without a name: %w", application.ErrCatalogUnavailable)
	}
	return domain.CatalogItem{Name: answer.Name}, nil
}

// ItemIcon reads the icon's asset URL from the item media and fetches the icon from the allowlisted asset host.
func (c *Catalog) ItemIcon(ctx context.Context, itemID domain.ItemID) (domain.ItemIcon, error) {
	var media struct {
		Assets []struct {
			Key   string `json:"key"`
			Value string `json:"value"`
		} `json:"assets"`
	}
	if err := c.getJSON(ctx, "/data/wow/media/item/"+strconv.Itoa(int(itemID)), &media); err != nil {
		return domain.ItemIcon{}, err
	}
	for _, asset := range media.Assets {
		if asset.Key == iconAssetKey {
			return c.fetchIcon(ctx, asset.Value)
		}
	}
	return domain.ItemIcon{}, application.ErrItemNotFound
}

// getJSON calls the Game Data API with the namespace and locale. 404 counts towards the streak guard; 200 resets it.
func (c *Catalog) getJSON(ctx context.Context, path string, into any) (err error) {
	token, err := c.accessToken(ctx)
	if err != nil {
		return err
	}
	query := url.Values{"namespace": {c.config.Namespace}, "locale": {locale}}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.apiBaseURL+path+"?"+query.Encode(), nil)
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+token)
	response, err := c.send(ctx, request)
	if err != nil {
		return err
	}
	defer func() { err = errors.Join(err, response.Body.Close()) }()
	switch response.StatusCode {
	case http.StatusOK:
		c.setStreak(0)
		if err := json.NewDecoder(io.LimitReader(response.Body, maxAnswerBytes)).Decode(into); err != nil {
			return fmt.Errorf("read answer: %w: %w", application.ErrCatalogUnavailable, err)
		}
		return nil
	case http.StatusNotFound:
		return c.notFound(ctx)
	case http.StatusUnauthorized:
		c.setToken("", time.Time{})
	}
	return fmt.Errorf("answer %d: %w", response.StatusCode, application.ErrCatalogUnavailable)
}

// accessToken returns the kept token, or gets a new one with the client credentials. A refusal pauses the catalog.
func (c *Catalog) accessToken(ctx context.Context) (_ string, err error) {
	c.mu.Lock()
	token, expiry := c.token, c.tokenExpiry
	c.mu.Unlock()
	if token != "" && c.clock.Now().Before(expiry) {
		return token, nil
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.tokenURL, strings.NewReader(url.Values{"grant_type": {clientCredential}}.Encode()))
	if err != nil {
		return "", err
	}
	request.SetBasicAuth(c.config.ClientID, c.config.ClientSecret)
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := c.send(ctx, request)
	if err != nil {
		return "", err
	}
	defer func() { err = errors.Join(err, response.Body.Close()) }()
	if response.StatusCode != http.StatusOK {
		c.pause(ctx, "token refused", response.StatusCode)
		return "", fmt.Errorf("token answer %d: %w", response.StatusCode, application.ErrCatalogUnavailable)
	}
	var answer struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, maxAnswerBytes)).Decode(&answer); err != nil || answer.AccessToken == "" {
		return "", fmt.Errorf("read token: %w", application.ErrCatalogUnavailable)
	}
	c.setToken(answer.AccessToken, c.clock.Now().Add(time.Duration(answer.ExpiresIn)*time.Second-tokenRenewMargin))
	return answer.AccessToken, nil
}

// fetchIcon gets the icon bytes without the token. Only JPEG or PNG by the bytes, at most domain.MaxItemIconBytes.
func (c *Catalog) fetchIcon(ctx context.Context, assetURL string) (_ domain.ItemIcon, err error) {
	parsed, err := url.Parse(assetURL)
	if err != nil || !c.isAllowed(parsed) {
		c.logger.WarnContext(ctx, "item icon host not allowed", "host", hostOf(parsed))
		return domain.ItemIcon{}, application.ErrItemNotFound
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return domain.ItemIcon{}, err
	}
	response, err := c.send(ctx, request)
	if err != nil {
		return domain.ItemIcon{}, err
	}
	defer func() { err = errors.Join(err, response.Body.Close()) }()
	if response.StatusCode != http.StatusOK {
		return domain.ItemIcon{}, application.ErrItemNotFound
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, domain.MaxItemIconBytes+1))
	if err != nil {
		return domain.ItemIcon{}, fmt.Errorf("read icon: %w: %w", application.ErrCatalogUnavailable, err)
	}
	mediaType := http.DetectContentType(data)
	if len(data) > domain.MaxItemIconBytes || (mediaType != jpegMediaType && mediaType != pngMediaType) {
		c.logger.WarnContext(ctx, "item icon refused", "mediaType", mediaType, "bytes", len(data))
		return domain.ItemIcon{}, application.ErrItemNotFound
	}
	return domain.ItemIcon{MediaType: mediaType, Bytes: data}, nil
}

// send waits for the rate limit and makes the call, unless the catalog is paused. A 429 or 5xx answer pauses it.
func (c *Catalog) send(ctx context.Context, request *http.Request) (*http.Response, error) {
	c.mu.Lock()
	paused := c.clock.Now().Before(c.pausedUntil)
	c.mu.Unlock()
	if paused {
		return nil, fmt.Errorf("paused: %w", application.ErrCatalogUnavailable)
	}
	select {
	case <-c.callTicks:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	response, err := c.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("call: %w: %w", application.ErrCatalogUnavailable, err)
	}
	if response.StatusCode == http.StatusTooManyRequests || response.StatusCode >= http.StatusInternalServerError {
		c.pause(ctx, "answer refused", response.StatusCode)
		return nil, errors.Join(fmt.Errorf("answer %d: %w", response.StatusCode, application.ErrCatalogUnavailable), response.Body.Close())
	}
	return response, nil
}

// pause stops all calls for catalogBackoff, logged once per pause.
func (c *Catalog) pause(ctx context.Context, reason string, status int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.clock.Now().Before(c.pausedUntil) {
		return
	}
	c.pausedUntil = c.clock.Now().Add(catalogBackoff)
	c.logger.WarnContext(ctx, "item catalog paused", "reason", reason, "status", status, "pause", catalogBackoff.String())
}

// notFound answers ErrItemNotFound until the streak is longer than maxConsecutiveNotFound, then unavailable with a
// warning on each answer. The calls go on, so a 200 can end the streak.
func (c *Catalog) notFound(ctx context.Context) error {
	c.mu.Lock()
	c.notFoundStreak++
	streak := c.notFoundStreak
	c.mu.Unlock()
	if streak <= maxConsecutiveNotFound {
		return application.ErrItemNotFound
	}
	c.logger.WarnContext(ctx, "namespace answers not found for every item, check BLIZZARD_NAMESPACE", "namespace", c.config.Namespace)
	return fmt.Errorf("not found streak: %w", application.ErrCatalogUnavailable)
}

func (c *Catalog) setStreak(streak int) {
	c.mu.Lock()
	c.notFoundStreak = streak
	c.mu.Unlock()
}

func (c *Catalog) setToken(token string, expiry time.Time) {
	c.mu.Lock()
	c.token, c.tokenExpiry = token, expiry
	c.mu.Unlock()
}

// isAllowed accepts only https to a host of the allowlist (ADR 0029 section 4).
func (c *Catalog) isAllowed(target *url.URL) bool {
	return target.Scheme == secureScheme && slices.Contains(c.allowedHosts, target.Host)
}

func hostOf(parsed *url.URL) string {
	if parsed == nil {
		return ""
	}
	return parsed.Host
}
