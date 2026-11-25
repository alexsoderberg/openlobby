package blizzard

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	testClientID     = "client-id"
	testClientSecret = "client-secret"
	testNamespace    = "static-forever-eu"
	testToken        = "token-1"
	// testCallInterval keeps the rate limit in the path of every call without slowing the tests.
	testCallInterval = time.Millisecond
)

var (
	pngIcon  = append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 64)...)
	jpegIcon = append([]byte{0xff, 0xd8, 0xff, 0xe0}, make([]byte, 64)...)
)

// fakeBlizzard answers the token, item, media and asset paths. status overrides the answer of the item and media paths.
type fakeBlizzard struct {
	t           *testing.T
	server      *httptest.Server
	mu          sync.Mutex
	names       map[string]string // item ID to name
	icons       map[string][]byte // asset path to bytes
	assetURL    func(itemID string) string
	status      int
	tokenStatus int
	tokenCalls  int
	apiCalls    int
	assetCalls  int
	// assetAuthorization is the Authorization header of the last asset request.
	assetAuthorization string
}

func newFakeBlizzard(t *testing.T) *fakeBlizzard {
	f := &fakeBlizzard{t: t, names: map[string]string{"19019": "Thunderfury"}, icons: map[string][]byte{"/forever-eu/icons/56/19019.jpg": jpegIcon}}
	// The asset path has the shape Blizzard gives for Forever: /forever-eu/icons/56/<file>.jpg.
	f.assetURL = func(itemID string) string { return f.server.URL + "/forever-eu/icons/56/" + itemID + ".jpg" }
	mux := http.NewServeMux()
	mux.HandleFunc("POST /token", f.token)
	mux.HandleFunc("GET /data/wow/item/{itemId}", f.api(func(w http.ResponseWriter, itemID string) {
		f.write(w, map[string]string{"name": f.names[itemID]})
	}))
	mux.HandleFunc("GET /data/wow/media/item/{itemId}", f.api(func(w http.ResponseWriter, itemID string) {
		f.write(w, map[string]any{"assets": []map[string]string{{"key": "icon", "value": f.assetURL(itemID)}}})
	}))
	mux.HandleFunc("GET /forever-eu/icons/56/{name}", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.assetCalls++
		f.assetAuthorization = r.Header.Get("Authorization")
		icon, found := f.icons[r.URL.Path]
		f.mu.Unlock()
		if !found {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write(icon)
	})
	f.server = httptest.NewTLSServer(mux)
	t.Cleanup(f.server.Close)
	return f
}

func (f *fakeBlizzard) token(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	f.tokenCalls++
	tokenStatus := f.tokenStatus
	f.mu.Unlock()
	if tokenStatus != 0 {
		w.WriteHeader(tokenStatus)
		return
	}
	id, secret, ok := r.BasicAuth()
	if err := r.ParseForm(); err != nil || !ok || id != testClientID || secret != testClientSecret || r.PostForm.Get("grant_type") != "client_credentials" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	f.write(w, map[string]any{"access_token": testToken, "expires_in": 86399})
}

// api checks the token, namespace and locale of a Game Data call, then answers a 404 for an item without a name.
func (f *fakeBlizzard) api(answer func(http.ResponseWriter, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.apiCalls++
		status := f.status
		_, known := f.names[r.PathValue("itemId")]
		f.mu.Unlock()
		if r.Header.Get("Authorization") != "Bearer "+testToken || r.URL.Query().Get("namespace") != testNamespace || r.URL.Query().Get("locale") != "en_US" {
			f.t.Errorf("call %s: authorization %q, query %q", r.URL.Path, r.Header.Get("Authorization"), r.URL.RawQuery)
		}
		switch {
		case status != 0:
			w.WriteHeader(status)
		case !known:
			http.NotFound(w, r)
		default:
			answer(w, r.PathValue("itemId"))
		}
	}
}

func (f *fakeBlizzard) write(w http.ResponseWriter, body any) {
	if err := json.NewEncoder(w).Encode(body); err != nil {
		f.t.Error(err)
	}
}

func (f *fakeBlizzard) setStatus(status int) {
	f.mu.Lock()
	f.status = status
	f.mu.Unlock()
}

// testClock is a clock the test moves forward.
type testClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *testClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *testClock) advance(d time.Duration) {
	c.mu.Lock()
	c.now = c.now.Add(d)
	c.mu.Unlock()
}

// newTestCatalog trusts the test certificate, which every TLS test server shares.
func newTestCatalog(f *fakeBlizzard, clock *testClock, logs io.Writer) *Catalog {
	config := Config{ClientID: testClientID, ClientSecret: testClientSecret, Region: "eu", Namespace: testNamespace}
	return withServer(newCatalog(config, f.server.URL+"/token", f.server.URL, []string{serverHost(f)}, testCallInterval, clock, slog.New(slog.NewTextHandler(logs, nil))), f)
}

func serverHost(f *fakeBlizzard) string { return strings.TrimPrefix(f.server.URL, "https://") }

func withServer(catalog *Catalog, f *fakeBlizzard) *Catalog {
	catalog.client.Transport = f.server.Client().Transport
	return catalog
}

func newClock() *testClock { return &testClock{now: time.Date(2026, 11, 25, 12, 0, 0, 0, time.UTC)} }

func TestNewRefusesAnUnknownRegion(t *testing.T) {
	if _, err := New(Config{Region: "cn"}, newClock(), slog.Default()); err == nil {
		t.Fatal("region cn accepted; want an error")
	}
	if _, err := New(Config{Region: "eu"}, newClock(), slog.Default()); err != nil {
		t.Fatalf("region eu: %v", err)
	}
}

// The token is fetched once with the client credentials and kept until 60 s before its expiry.
func TestItemUsesTheClientCredentialsTokenUntilItExpires(t *testing.T) {
	fake, clock, logs := newFakeBlizzard(t), newClock(), &bytes.Buffer{}
	catalog := newTestCatalog(fake, clock, logs)

	for range 2 {
		item, err := catalog.Item(context.Background(), 19019)
		if err != nil || item.Name != "Thunderfury" {
			t.Fatalf("item %+v, error %v; want Thunderfury", item, err)
		}
	}
	if fake.tokenCalls != 1 {
		t.Fatalf("%d token calls; want the token kept", fake.tokenCalls)
	}
	clock.advance(86399*time.Second - tokenRenewMargin)
	if _, err := catalog.Item(context.Background(), 19019); err != nil {
		t.Fatal(err)
	}
	if fake.tokenCalls != 2 {
		t.Fatalf("%d token calls; want a new token 60 s before the expiry", fake.tokenCalls)
	}
	if strings.Contains(logs.String(), testToken) || strings.Contains(logs.String(), testClientSecret) {
		t.Fatalf("log %q contains a secret", logs.String())
	}
}

func TestATokenRefusalPausesTheCatalog(t *testing.T) {
	fake, clock := newFakeBlizzard(t), newClock()
	catalog := newTestCatalog(fake, clock, io.Discard)
	catalog.config.ClientSecret = "wrong"

	for range 2 {
		if _, err := catalog.Item(context.Background(), 19019); !errors.Is(err, application.ErrCatalogUnavailable) {
			t.Fatalf("error %v; want ErrCatalogUnavailable", err)
		}
	}
	if fake.tokenCalls != 1 {
		t.Fatalf("%d token calls; want the pause to stop the second", fake.tokenCalls)
	}
}

// 404 is not found until the streak is longer than 10; the guard keeps calling, and a 200 ends it (ADR 0029 section 4).
func TestTheNotFoundStreakGuard(t *testing.T) {
	fake, logs := newFakeBlizzard(t), &bytes.Buffer{}
	catalog := newTestCatalog(fake, newClock(), logs)
	ctx := context.Background()

	for call := 1; call <= maxConsecutiveNotFound; call++ {
		if _, err := catalog.Item(ctx, 5); !errors.Is(err, application.ErrItemNotFound) {
			t.Fatalf("call %d: %v; want ErrItemNotFound", call, err)
		}
	}
	for range 2 {
		if _, err := catalog.Item(ctx, 5); !errors.Is(err, application.ErrCatalogUnavailable) {
			t.Fatalf("after the streak: %v; want ErrCatalogUnavailable", err)
		}
	}
	if fake.apiCalls != maxConsecutiveNotFound+2 {
		t.Fatalf("%d calls; want the guard to keep calling", fake.apiCalls)
	}
	if strings.Count(logs.String(), "check BLIZZARD_NAMESPACE") != 2 {
		t.Fatalf("log %q; want a warning on each guarded answer", logs.String())
	}
	if _, err := catalog.Item(ctx, 19019); err != nil {
		t.Fatal(err)
	}
	if _, err := catalog.Item(ctx, 5); !errors.Is(err, application.ErrItemNotFound) {
		t.Fatalf("after a 200: %v; want ErrItemNotFound again", err)
	}
}

// A 429 or 5xx pauses all calls for 60 s, logged once (ADR 0029 section 4).
func TestARefusalPausesAllCallsForTheBackoff(t *testing.T) {
	for _, status := range []int{http.StatusTooManyRequests, http.StatusServiceUnavailable} {
		fake, clock, logs := newFakeBlizzard(t), newClock(), &bytes.Buffer{}
		catalog := newTestCatalog(fake, clock, logs)
		fake.setStatus(status)

		for range 2 {
			if _, err := catalog.Item(context.Background(), 19019); !errors.Is(err, application.ErrCatalogUnavailable) {
				t.Fatalf("%d: %v; want ErrCatalogUnavailable", status, err)
			}
		}
		if fake.apiCalls != 1 || strings.Count(logs.String(), "item catalog paused") != 1 {
			t.Fatalf("%d: %d calls, log %q; want one call and one warning", status, fake.apiCalls, logs.String())
		}
		fake.setStatus(0)
		clock.advance(catalogBackoff)
		if _, err := catalog.Item(context.Background(), 19019); err != nil {
			t.Fatalf("%d after the backoff: %v", status, err)
		}
	}
}

func TestItemIcon(t *testing.T) {
	fake := newFakeBlizzard(t)
	fake.names["2"], fake.icons["/forever-eu/icons/56/2.jpg"] = "Png", pngIcon
	fake.names["3"], fake.icons["/forever-eu/icons/56/3.jpg"] = "Gif", []byte("GIF89a")
	fake.names["4"], fake.icons["/forever-eu/icons/56/4.jpg"] = "Large", append(append([]byte{}, pngIcon...), make([]byte, domain.MaxItemIconBytes)...)
	fake.names["6"] = "No asset"
	tests := []struct {
		item      domain.ItemID
		wantType  string
		wantError error
	}{
		{item: 19019, wantType: "image/jpeg"},
		{item: 2, wantType: "image/png"},
		{item: 3, wantError: application.ErrItemNotFound},
		{item: 4, wantError: application.ErrItemNotFound},
		{item: 6, wantError: application.ErrItemNotFound},
		{item: 5, wantError: application.ErrItemNotFound},
	}
	catalog := newTestCatalog(fake, newClock(), io.Discard)
	for _, tc := range tests {
		icon, err := catalog.ItemIcon(context.Background(), tc.item)
		if !errors.Is(err, tc.wantError) || icon.MediaType != tc.wantType {
			t.Errorf("item %d: %q, %v; want %q, %v", tc.item, icon.MediaType, err, tc.wantType, tc.wantError)
		}
	}
	if fake.assetCalls == 0 || fake.assetAuthorization != "" {
		t.Fatalf("%d asset calls, Authorization %q; want the token never sent to the asset host", fake.assetCalls, fake.assetAuthorization)
	}
}

// An asset URL on an allowed host without https is never fetched.
func TestTheIconNeedsHTTPS(t *testing.T) {
	fake := newFakeBlizzard(t)
	catalog := newTestCatalog(fake, newClock(), io.Discard)
	fake.assetURL = func(itemID string) string {
		return "http://" + serverHost(fake) + "/forever-eu/icons/56/" + itemID + ".jpg"
	}

	if _, err := catalog.ItemIcon(context.Background(), 19019); !errors.Is(err, application.ErrItemNotFound) {
		t.Fatalf("http asset URL: %v; want ErrItemNotFound", err)
	}
	if fake.assetCalls != 0 {
		t.Fatalf("%d asset calls; want none", fake.assetCalls)
	}
}

// An asset URL or a redirect to a host off the allowlist is never fetched (ADR 0029 section 4).
func TestTheIconHostAllowlist(t *testing.T) {
	elsewhere := newFakeBlizzard(t)
	fake := newFakeBlizzard(t)
	catalog := newTestCatalog(fake, newClock(), io.Discard)

	fake.assetURL = func(itemID string) string { return elsewhere.server.URL + "/forever-eu/icons/56/" + itemID + ".jpg" }
	if _, err := catalog.ItemIcon(context.Background(), 19019); !errors.Is(err, application.ErrItemNotFound) {
		t.Fatalf("foreign asset host: %v; want ErrItemNotFound", err)
	}

	redirect := url.QueryEscape(elsewhere.server.URL + "/forever-eu/icons/56/19019.jpg")
	fake.server.Config.Handler.(*http.ServeMux).HandleFunc("GET /redirect", func(w http.ResponseWriter, r *http.Request) {
		target, _ := url.QueryUnescape(r.URL.Query().Get("to"))
		http.Redirect(w, r, target, http.StatusFound)
	})
	fake.assetURL = func(string) string { return fake.server.URL + "/redirect?to=" + redirect }
	if _, err := catalog.ItemIcon(context.Background(), 19019); !errors.Is(err, application.ErrCatalogUnavailable) {
		t.Fatalf("redirect to a foreign host: %v; want ErrCatalogUnavailable", err)
	}
	if elsewhere.assetCalls != 0 {
		t.Fatalf("%d calls to the foreign host; want none", elsewhere.assetCalls)
	}
}

// The calls wait for the rate limit, and a cancelled request stops waiting.
func TestTheRateLimit(t *testing.T) {
	fake := newFakeBlizzard(t)
	interval := 20 * time.Millisecond
	catalog := withServer(newCatalog(Config{ClientID: testClientID, ClientSecret: testClientSecret, Namespace: testNamespace}, fake.server.URL+"/token",
		fake.server.URL, []string{serverHost(fake)}, interval, newClock(), slog.New(slog.NewTextHandler(io.Discard, nil))), fake)

	start := time.Now()
	for range 3 {
		if _, err := catalog.Item(context.Background(), 19019); err != nil {
			t.Fatal(err)
		}
	}
	// Four calls (one token, three items) need at least three intervals.
	if elapsed := time.Since(start); elapsed < 3*interval {
		t.Fatalf("4 calls in %v; want at least %v", elapsed, 3*interval)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := catalog.Item(ctx, 19019); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled: %v; want context.Canceled", err)
	}
}

// notFoundTimes asks for an unknown item n times and expects not found each time.
func notFoundTimes(t *testing.T, catalog *Catalog, n int) {
	t.Helper()
	for call := 1; call <= n; call++ {
		if _, err := catalog.Item(context.Background(), 5); !errors.Is(err, application.ErrItemNotFound) {
			t.Fatalf("call %d: %v; want ErrItemNotFound", call, err)
		}
	}
}

// A token 404 pauses the catalog and does not count toward the streak (ADR 0029 Amendment 2026-11-25 items 7, 8).
func TestATokenNotFoundDoesNotCountTowardTheStreak(t *testing.T) {
	fake, clock := newFakeBlizzard(t), newClock()
	catalog := newTestCatalog(fake, clock, io.Discard)
	notFoundTimes(t, catalog, maxConsecutiveNotFound-1)
	catalog.setToken("", time.Time{})
	fake.mu.Lock()
	fake.tokenStatus = http.StatusNotFound
	fake.mu.Unlock()

	if _, err := catalog.Item(context.Background(), 5); !errors.Is(err, application.ErrCatalogUnavailable) {
		t.Fatalf("token 404: %v; want ErrCatalogUnavailable", err)
	}
	fake.mu.Lock()
	fake.tokenStatus = 0
	fake.mu.Unlock()
	clock.advance(catalogBackoff)

	// The tenth item 404 is still not found: the token 404 did not count.
	notFoundTimes(t, catalog, 1)
}

// An item 200 with an empty name is unavailable, but it is a 200, so it resets the streak.
func TestAnItemWithoutANameResetsTheStreak(t *testing.T) {
	fake := newFakeBlizzard(t)
	fake.names["8"] = ""
	catalog := newTestCatalog(fake, newClock(), io.Discard)
	notFoundTimes(t, catalog, maxConsecutiveNotFound)

	if _, err := catalog.Item(context.Background(), 8); !errors.Is(err, application.ErrCatalogUnavailable) {
		t.Fatalf("empty name: %v; want ErrCatalogUnavailable", err)
	}

	notFoundTimes(t, catalog, maxConsecutiveNotFound)
}

// A 404 from the asset host is a missing icon; it does not count toward the streak.
func TestAnAssetNotFoundDoesNotCountTowardTheStreak(t *testing.T) {
	fake := newFakeBlizzard(t)
	fake.names["9"] = "No icon file"
	catalog := newTestCatalog(fake, newClock(), io.Discard)
	notFoundTimes(t, catalog, maxConsecutiveNotFound-1)

	if _, err := catalog.ItemIcon(context.Background(), 9); !errors.Is(err, application.ErrItemNotFound) {
		t.Fatalf("asset 404: %v; want ErrItemNotFound", err)
	}
	catalog.mu.Lock()
	streak := catalog.notFoundStreak
	catalog.mu.Unlock()
	if streak != 0 {
		t.Fatalf("streak %d after the media 200 and the asset 404; want 0", streak)
	}
}

// A token call that fails in transport does not pause the catalog; the next call goes through.
func TestATokenTransportErrorDoesNotPause(t *testing.T) {
	fake := newFakeBlizzard(t)
	catalog := newTestCatalog(fake, newClock(), io.Discard)
	closed := httptest.NewServer(http.NotFoundHandler())
	closed.Close()
	catalog.tokenURL = closed.URL + "/token"

	if _, err := catalog.Item(context.Background(), 19019); !errors.Is(err, application.ErrCatalogUnavailable) {
		t.Fatalf("transport error: %v; want ErrCatalogUnavailable", err)
	}
	catalog.tokenURL = fake.server.URL + "/token"
	if _, err := catalog.Item(context.Background(), 19019); err != nil {
		t.Fatalf("after a transport error: %v; want no pause", err)
	}
}
