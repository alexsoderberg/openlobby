package transport_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/iotest"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const logoPath = gamePath + "/images/logo"

// memoryImages stores the images of memoryGroups with the adapter's rules: an unknown game is not found, and a game read
// carries the version of its logo, as the join does.
type memoryImages struct{ store *memoryGroups }

func (m memoryImages) Save(_ context.Context, gameID string, image domain.GameImage) (domain.Game, error) {
	index := m.store.gameIndex(gameID)
	if index < 0 {
		return domain.Game{}, application.ErrGameNotFound
	}
	m.store.images[gameID] = image
	m.store.games[index].LogoVersion = &image.Version
	return m.store.games[index], nil
}

func (m memoryImages) Delete(_ context.Context, gameID, _ string) error {
	index := m.store.gameIndex(gameID)
	if index < 0 {
		return application.ErrGameNotFound
	}
	delete(m.store.images, gameID)
	m.store.games[index].LogoVersion = nil
	return nil
}

func (m memoryImages) Find(_ context.Context, gameID, _, version string) (domain.GameImage, bool, error) {
	image, found := m.store.images[gameID]
	return image, found && image.Version == version, nil
}

// pngOf returns a PNG signature padded to size bytes.
func pngOf(size int) string {
	data := make([]byte, size)
	copy(data, "\x89PNG\r\n\x1a\n")
	return string(data)
}

func imageStore() *memoryGroups {
	store := gameStore()
	store.images = map[string]domain.GameImage{}
	return store
}

// A 100 KiB image is stored although every other body is limited to 16 KiB, and the Content-Type does not matter
// (ADR 0026 point 9). The answer is the game with its new version.
func TestSetGameImageAcceptsAnImageOverTheJSONLimit(t *testing.T) {
	store := imageStore()
	headers := asAdminUser(alexID)
	headers["Content-Type"] = "text/plain"

	response := call(gameRouter(store), http.MethodPut, logoPath, headers, pngOf(100<<10))

	if response.Code != http.StatusOK {
		t.Fatalf("status %d, want 200; body %q", response.Code, response.Body.String())
	}
	var game map[string]any
	if err := json.Unmarshal(response.Body.Bytes(), &game); err != nil {
		t.Fatal(err)
	}
	if version, _ := game["logoVersion"].(string); len(version) != 64 || game["id"] != overwatchID {
		t.Fatalf("game %v, want overwatch with a logo version", game)
	}
}

// The checks of ADR 0026 point 3, in their order.
func TestSetGameImageRefusals(t *testing.T) {
	tests := []struct {
		name       string
		path       string
		headers    map[string]string
		body       string
		wantStatus int
		wantCode   string
	}{
		{name: "malformed game ID", path: gameRoot + "/not-a-uuid/images/logo", headers: asAdminUser(alexID), body: pngOf(10), wantStatus: http.StatusNotFound, wantCode: "game_not_found"},
		{name: "unknown kind", path: gamePath + "/images/banner", headers: asAdminUser(alexID), body: pngOf(10), wantStatus: http.StatusNotFound, wantCode: "game_image_not_found"},
		{name: "non-admin with a too large body", path: logoPath, headers: asUser(alexID), body: pngOf(domain.MaxGameImageBytes + 1), wantStatus: http.StatusForbidden, wantCode: "not_allowed"},
		{name: "one byte over the limit", path: logoPath, headers: asAdminUser(alexID), body: pngOf(domain.MaxGameImageBytes + 1), wantStatus: http.StatusRequestEntityTooLarge, wantCode: "image_too_large"},
		{name: "far over the limit", path: logoPath, headers: asAdminUser(alexID), body: pngOf(domain.MaxGameImageBytes * 2), wantStatus: http.StatusRequestEntityTooLarge, wantCode: "image_too_large"},
		{name: "text named as png", path: logoPath, headers: asAdminUser(alexID), body: "<svg></svg>", wantStatus: http.StatusBadRequest, wantCode: "invalid_image_type"},
		{name: "empty body", path: logoPath, headers: asAdminUser(alexID), body: "", wantStatus: http.StatusBadRequest, wantCode: "invalid_image_type"},
		{name: "unknown game", path: gameRoot + "/" + missingID + "/images/logo", headers: asAdminUser(alexID), body: pngOf(10), wantStatus: http.StatusNotFound, wantCode: "game_not_found"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			store := imageStore()
			tc.headers["Content-Type"] = "image/png"

			assertErrorEnvelope(t, call(gameRouter(store), http.MethodPut, tc.path, tc.headers, tc.body), tc.wantStatus, tc.wantCode)

			if len(store.images) != 0 {
				t.Fatalf("a refused upload changed the images: %v", store.images)
			}
		})
	}
}

// An unknown kind is a path check, so it answers 404 before the body is read, even a body that cannot be read
// (ADR 0026 Amendment 2026-11-16 item 6, ADR 0001 step 2).
func TestSetGameImageChecksTheKindBeforeTheBody(t *testing.T) {
	request := httptest.NewRequest(http.MethodPut, gamePath+"/images/banner", iotest.ErrReader(errors.New("broken body")))
	for name, value := range asAdminUser(alexID) {
		request.Header.Set(name, value)
	}
	request.Header.Set("Content-Type", "image/png")
	response := httptest.NewRecorder()

	gameRouter(imageStore()).ServeHTTP(response, request)

	assertErrorEnvelope(t, response, http.StatusNotFound, "game_image_not_found")
}

// Remove is for the system admin only and answers 204 also when there is no image (ADR 0026 point 3).
func TestRemoveGameImage(t *testing.T) {
	store := imageStore()
	router := gameRouter(store)
	if response := call(router, http.MethodPut, logoPath, asAdminUser(alexID), pngOf(10)); response.Code != http.StatusOK {
		t.Fatalf("upload status %d", response.Code)
	}

	assertErrorEnvelope(t, call(router, http.MethodDelete, logoPath, asUser(alexID), ""), http.StatusForbidden, "not_allowed")
	assertErrorEnvelope(t, call(router, http.MethodDelete, gamePath+"/images/banner", asAdminUser(alexID), ""), http.StatusNotFound, "game_image_not_found")
	assertErrorEnvelope(t, call(router, http.MethodDelete, gameRoot+"/"+missingID+"/images/logo", asAdminUser(alexID), ""), http.StatusNotFound, "game_not_found")
	for range 2 {
		if response := call(router, http.MethodDelete, logoPath, asAdminUser(alexID), ""); response.Code != http.StatusNoContent {
			t.Fatalf("status %d, want 204; body %q", response.Code, response.Body.String())
		}
	}
	if len(store.images) != 0 {
		t.Fatalf("image left: %v", store.images)
	}
}

// Any logged-in user gets the current version with year-long caching; any other version is 404 without caching
// (ADR 0026 point 4).
func TestGetGameImage(t *testing.T) {
	store := imageStore()
	router := gameRouter(store)
	body := pngOf(64)
	if response := call(router, http.MethodPut, logoPath, asAdminUser(alexID), body); response.Code != http.StatusOK {
		t.Fatalf("upload status %d", response.Code)
	}
	version := *store.games[store.gameIndex(overwatchID)].LogoVersion

	response := call(router, http.MethodGet, logoPath+"?v="+version, asUser(otherID), "")

	if response.Code != http.StatusOK || !bytes.Equal(response.Body.Bytes(), []byte(body)) {
		t.Fatalf("status %d, %d bytes; want 200 with the image", response.Code, response.Body.Len())
	}
	wantHeaders := map[string]string{"Content-Type": "image/png", "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff"}
	for name, want := range wantHeaders {
		if got := response.Header().Get(name); got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}
	for name, path := range map[string]string{
		"stale version":   logoPath + "?v=" + strings.Repeat("0", 64),
		"missing version": logoPath,
		"unknown kind":    gamePath + "/images/banner?v=" + version,
		"unknown game":    gameRoot + "/" + missingID + "/images/logo?v=" + version,
	} {
		refused := call(router, http.MethodGet, path, asUser(otherID), "")
		assertErrorEnvelope(t, refused, http.StatusNotFound, "game_image_not_found")
		if refused.Header().Get("Cache-Control") != "" {
			t.Errorf("%s: Cache-Control %q on a 404", name, refused.Header().Get("Cache-Control"))
		}
	}
}

// Every image operation needs a session (ADR 0002).
func TestGameImageNeedsIdentity(t *testing.T) {
	for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		assertErrorEnvelope(t, call(gameRouter(imageStore()), method, logoPath, map[string]string{}, ""), http.StatusUnauthorized, "unauthenticated")
	}
}
