//go:build integration

package postgres

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

func logoOf(t *testing.T, data []byte) domain.GameImage {
	t.Helper()
	image, err := domain.NewGameImage("logo", data)
	if err != nil {
		t.Fatal(err)
	}
	return image
}

// A replace keeps one row per kind, a find gives the bytes, and the game reads carry the version (ADR 0026 point 5).
func TestGameImageSaveReplaceFindAndVersions(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()
	first, second := logoOf(t, []byte{0xff, 0xd8, 0xff, 1}), logoOf(t, []byte("\x89PNG\r\n\x1a\nmore"))

	for _, image := range []domain.GameImage{first, second} {
		saved, err := store.GameImages().Save(ctx, overwatchID, image)
		if err != nil || saved.ID != overwatchID || saved.LogoVersion == nil || *saved.LogoVersion != image.Version {
			t.Fatalf("saved %+v, error %v; want the game with the new version, read in the write", saved, err)
		}
	}

	if n := count(t, store, `SELECT count(*) FROM game_images WHERE game_id = $1`, overwatchID); n != 1 {
		t.Fatalf("%d rows, want one per kind", n)
	}
	found, ok, err := store.GameImages().Find(ctx, overwatchID, "logo", second.Version)
	if err != nil || !ok || found.Version != second.Version || found.MediaType != "image/png" || !bytes.Equal(found.Data, second.Data) {
		t.Fatalf("found %+v, %v, error %v; want the second image", found, ok, err)
	}
	for _, stale := range []string{first.Version, ""} {
		if _, ok, err := store.GameImages().Find(ctx, overwatchID, "logo", stale); ok || err != nil {
			t.Fatalf("version %q: found %v, error %v; want nothing", stale, ok, err)
		}
	}
	game, err := store.Games().Find(ctx, overwatchID)
	if err != nil || game.LogoVersion == nil || *game.LogoVersion != second.Version {
		t.Fatalf("game %+v, error %v; want the logo version", game, err)
	}
	list, err := store.Games().List(ctx)
	if err != nil {
		t.Fatal(err)
	}
	usages, err := store.Games().ListForGroup(ctx, fridayID)
	if err != nil {
		t.Fatal(err)
	}
	for _, listed := range append(list, gamesOf(usages)...) {
		if (listed.ID == overwatchID) != (listed.LogoVersion != nil) {
			t.Fatalf("game %s has logo version %v in a list", listed.ID, listed.LogoVersion)
		}
	}
	if _, ok, err := store.GameImages().Find(ctx, counterStrikeID, "logo", second.Version); ok || err != nil {
		t.Fatalf("game without logo: found %v, error %v", ok, err)
	}
}

func gamesOf(usages []application.GameUsage) []domain.Game {
	games := make([]domain.Game, 0, len(usages))
	for _, usage := range usages {
		games = append(games, usage.Game)
	}
	return games
}

// A write for a missing game is game_not_found by the foreign key; a delete is idempotent for a game that exists.
func TestGameImageMissingGameAndIdempotentDelete(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	const missing = "66666666-6666-4666-8666-666666666666"

	if _, err := store.GameImages().Save(ctx, missing, logoOf(t, []byte{0xff, 0xd8, 0xff})); !errors.Is(err, application.ErrGameNotFound) {
		t.Fatalf("save: error %v, want ErrGameNotFound", err)
	}
	if err := store.GameImages().Delete(ctx, missing, "logo"); !errors.Is(err, application.ErrGameNotFound) {
		t.Fatalf("delete: error %v, want ErrGameNotFound", err)
	}
	if _, err := store.GameImages().Save(ctx, overwatchID, logoOf(t, []byte{0xff, 0xd8, 0xff})); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err := store.GameImages().Delete(ctx, overwatchID, "logo"); err != nil {
			t.Fatalf("delete: %v", err)
		}
	}
	if game, err := store.Games().Find(ctx, overwatchID); err != nil || game.LogoVersion != nil {
		t.Fatalf("game %+v, error %v; want no logo after the delete", game, err)
	}
}

// The checks of migration 0010 refuse what the domain refuses, and a removed game takes its images (ADR 0026 point 2).
func TestGameImageConstraintsAndCascade(t *testing.T) {
	store := migratedStore(t)
	ctx := context.Background()
	version := strings.Repeat("a", 64)
	for name, row := range map[string][]any{
		"unknown kind":       {overwatchID, "banner", "image/png", version, []byte{1}},
		"unknown media type": {overwatchID, "logo", "image/svg+xml", version, []byte{1}},
		"bad version":        {overwatchID, "logo", "image/png", "ABC", []byte{1}},
		"empty image":        {overwatchID, "logo", "image/png", version, []byte{}},
		"over the limit":     {overwatchID, "logo", "image/png", version, make([]byte, domain.MaxGameImageBytes+1)},
	} {
		if _, err := store.db.ExecContext(ctx, `INSERT INTO game_images (game_id, kind, media_type, version, image) VALUES ($1, $2, $3, $4, $5)`, row...); err == nil {
			t.Errorf("%s: stored, want a check violation", name)
		}
	}
	for _, kind := range []string{"logo", "cover"} {
		data := append([]byte{0xff, 0xd8, 0xff}, make([]byte, domain.MaxGameImageBytes-3)...)
		image := logoOf(t, data)
		image.Kind = kind
		if _, err := store.GameImages().Save(ctx, overwatchID, image); err != nil {
			t.Fatalf("%s at the limit: %v", kind, err)
		}
	}

	if err := store.Games().Delete(ctx, overwatchID); err != nil {
		t.Fatal(err)
	}
	if n := count(t, store, `SELECT count(*) FROM game_images`); n != 0 {
		t.Fatalf("%d images left after the game was removed", n)
	}
}

// The lobby reads join the logo version at each read: set, removed, an open lobby and a removed game (ADR 0026 point 5).
func TestLobbyGameLogoVersionFollowsTheGame(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()
	gameID := counterStrikeID
	byGame := insertLobby(t, store, newLobby(fridayID, alexID, &gameID, "Counter-Strike 2"))
	open := openLobby(t, store)
	logo := logoOf(t, []byte{0xff, 0xd8, 0xff})
	logoOfLobby := func(lobbyID string) *string {
		t.Helper()
		lobby, _, err := store.Lobbies().Lobby(ctx, fridayID, lobbyID, alexID, joinedAt)
		if err != nil {
			t.Fatal(err)
		}
		return lobby.GameLogoVersion
	}
	if _, err := store.GameImages().Save(ctx, counterStrikeID, logo); err != nil {
		t.Fatal(err)
	}

	if got := logoOfLobby(byGame.ID); got == nil || *got != logo.Version {
		t.Fatalf("logo version %v, want %s", got, logo.Version)
	}
	upcoming, err := store.Lobbies().Upcoming(ctx, fridayID, alexID, joinedAt)
	if err != nil {
		t.Fatal(err)
	}
	for _, lobby := range upcoming {
		if (lobby.ID == byGame.ID) != (lobby.GameLogoVersion != nil) {
			t.Fatalf("lobby %s has logo version %v in the list", lobby.ID, lobby.GameLogoVersion)
		}
	}
	if logoOfLobby(open.ID) != nil {
		t.Fatal("open lobby has a logo version")
	}
	saved, err := seatLobbies(store).SetGame(ctx, fridayID, open.ID, alexID, counterStrikeID)
	if err != nil || saved.GameLogoVersion == nil || *saved.GameLogoVersion != logo.Version {
		t.Fatalf("set game: lobby %+v, error %v; want the logo version", saved, err)
	}
	if err := store.GameImages().Delete(ctx, counterStrikeID, "logo"); err != nil {
		t.Fatal(err)
	}
	if logoOfLobby(byGame.ID) != nil {
		t.Fatal("lobby keeps a removed logo")
	}
	if _, err := store.GameImages().Save(ctx, counterStrikeID, logo); err != nil {
		t.Fatal(err)
	}
	if err := store.Games().Delete(ctx, counterStrikeID); err != nil {
		t.Fatal(err)
	}
	lobby, _, err := store.Lobbies().Lobby(ctx, fridayID, byGame.ID, alexID, joinedAt)
	if err != nil || lobby.GameLogoVersion != nil || lobby.GameName == nil {
		t.Fatalf("lobby of a removed game %+v, error %v; want its name and no logo", lobby, err)
	}
}

// A lobby created with a game that has a logo answers its version (the create reads the game in one snapshot).
func TestCreateLobbyAnswersTheLogoVersion(t *testing.T) {
	store := migratedStore(t)
	seedGroups(t, store)
	ctx := context.Background()
	logo := logoOf(t, []byte{0xff, 0xd8, 0xff})
	if _, err := store.GameImages().Save(ctx, counterStrikeID, logo); err != nil {
		t.Fatal(err)
	}
	gameID := counterStrikeID

	lobby, err := seatLobbies(store).Create(ctx, domain.NewLobbyRequest{GroupID: fridayID, CreatorID: alexID, GameID: &gameID,
		StartsAt: joinedAt.Add(time.Hour), EndsAt: joinedAt.Add(3 * time.Hour)})

	if err != nil || lobby.GameLogoVersion == nil || *lobby.GameLogoVersion != logo.Version {
		t.Fatalf("lobby %+v, error %v; want the logo version", lobby, err)
	}
}
