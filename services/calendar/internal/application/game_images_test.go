package application_test

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

var jpegBytes = []byte{0xff, 0xd8, 0xff, 0xe0}

// fakeImages keeps the images in memory with the adapter's rules: a write or delete on an unknown game is not found.
type fakeImages struct {
	games  map[string]bool
	images map[string]domain.GameImage
	writes int
}

func newFakeImages() *fakeImages {
	return &fakeImages{games: map[string]bool{gameID: true}, images: map[string]domain.GameImage{}}
}

// Save answers the game as the write left it, as the adapter reads it in the same transaction.
func (f *fakeImages) Save(_ context.Context, id string, image domain.GameImage) (domain.Game, error) {
	f.writes++
	if !f.games[id] {
		return domain.Game{}, application.ErrGameNotFound
	}
	f.images[id+image.Kind] = image
	return domain.Game{ID: id, Name: chessName, LogoVersion: f.version(id, "logo"), CoverVersion: f.version(id, "cover")}, nil
}

func (f *fakeImages) version(id, kind string) *string {
	if image, ok := f.images[id+kind]; ok {
		return &image.Version
	}
	return nil
}

func (f *fakeImages) Delete(_ context.Context, id, kind string) error {
	f.writes++
	if !f.games[id] {
		return application.ErrGameNotFound
	}
	delete(f.images, id+kind)
	return nil
}

func (f *fakeImages) Find(_ context.Context, id, kind, version string) (domain.GameImage, bool, error) {
	image, found := f.images[id+kind]
	return image, found && image.Version == version, nil
}

func newGameImages(images *fakeImages, logger *slog.Logger) *application.GameImages {
	return application.NewGameImages(images, logger)
}

// The admin check comes before any check of the image, so a non-admin learns nothing from the bytes (ADR 0026 point 3).
func TestSetGameImageChecksInOrder(t *testing.T) {
	tests := []struct {
		name  string
		actor domain.Actor
		game  string
		data  []byte
		want  error
	}{
		{name: "non-admin with an invalid image", actor: nonAdmin, game: gameID, data: []byte("text"), want: domain.ErrNotAllowed},
		{name: "non-admin with a too large image", actor: nonAdmin, game: gameID, data: make([]byte, domain.MaxGameImageBytes+1), want: domain.ErrNotAllowed},
		{name: "size before type", actor: admin, game: gameID, data: make([]byte, domain.MaxGameImageBytes+1), want: domain.ErrImageTooLarge},
		{name: "type before game", actor: admin, game: newID, data: []byte("text"), want: domain.ErrImageType},
		{name: "unknown game", actor: admin, game: newID, data: jpegBytes, want: application.ErrGameNotFound},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			images := newFakeImages()

			_, err := newGameImages(images, discardLog()).Set(context.Background(), tc.actor, tc.game, "logo", tc.data)

			if !errors.Is(err, tc.want) {
				t.Fatalf("error %v; want %v", err, tc.want)
			}
			if len(images.images) != 0 {
				t.Fatalf("a refused upload changed the images: %+v", images.images)
			}
		})
	}
}

// A stored image answers the game that the write read back in its own transaction, so no later read can turn a committed
// write into 503 (docs/services.md, service_unavailable). The change is logged without the bytes.
func TestSetGameImageStoresAndLogs(t *testing.T) {
	var logged bytes.Buffer
	images := newFakeImages()

	game, err := newGameImages(images, slog.New(slog.NewTextHandler(&logged, nil))).Set(context.Background(), admin, gameID, "logo", jpegBytes)

	stored := images.images[gameID+"logo"]
	if err != nil || game.ID != gameID || game.LogoVersion == nil || *game.LogoVersion != stored.Version || stored.MediaType != "image/jpeg" {
		t.Fatalf("game %+v, images %+v, error %v; want the game as the write left it", game, images.images, err)
	}
	line := logged.String()
	if !strings.Contains(line, "actorUserId="+aliceID) || !strings.Contains(line, "gameId="+gameID) || !strings.Contains(line, "kind=logo") {
		t.Fatalf("log %q, want the actor, the game and the kind", line)
	}
}

// Remove is idempotent, but only for a system admin and a game that exists.
func TestRemoveGameImage(t *testing.T) {
	images := newFakeImages()
	gameImages := newGameImages(images, discardLog())
	ctx := context.Background()

	if err := gameImages.Remove(ctx, nonAdmin, gameID, "logo"); !errors.Is(err, domain.ErrNotAllowed) || images.writes != 0 {
		t.Fatalf("non-admin: error %v, writes %d", err, images.writes)
	}
	if err := gameImages.Remove(ctx, admin, newID, "logo"); !errors.Is(err, application.ErrGameNotFound) {
		t.Fatalf("unknown game: error %v", err)
	}
	if _, err := gameImages.Set(ctx, admin, gameID, "logo", jpegBytes); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if err := gameImages.Remove(ctx, admin, gameID, "logo"); err != nil {
			t.Fatalf("remove: error %v", err)
		}
	}
	if len(images.images) != 0 {
		t.Fatalf("image left: %+v", images.images)
	}
}

// Only the current version gives the bytes, so a cached URL never holds newer bytes (ADR 0026 point 4).
func TestImageGivesOnlyTheCurrentVersion(t *testing.T) {
	images := newFakeImages()
	gameImages := newGameImages(images, discardLog())
	ctx := context.Background()
	old, err := domain.NewGameImage("logo", jpegBytes)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := gameImages.Set(ctx, admin, gameID, "logo", append(bytes.Clone(jpegBytes), 1)); err != nil {
		t.Fatal(err)
	}
	current := images.images[gameID+"logo"]

	for name, version := range map[string]string{"missing": "", "old": old.Version} {
		if _, err := gameImages.Image(ctx, gameID, "logo", version); !errors.Is(err, domain.ErrGameImageNotFound) {
			t.Fatalf("%s version: error %v; want ErrGameImageNotFound", name, err)
		}
	}
	if _, err := gameImages.Image(ctx, newID, "logo", current.Version); !errors.Is(err, domain.ErrGameImageNotFound) {
		t.Fatalf("unknown game: error %v", err)
	}
	image, err := gameImages.Image(ctx, gameID, "logo", current.Version)
	if err != nil || !bytes.Equal(image.Data, current.Data) {
		t.Fatalf("image %+v, error %v", image, err)
	}
}

// The kind is part of the path form, so an unknown kind is game_image_not_found before the admin check and before any
// write (ADR 0026 point 3).
func TestUnknownKindIsGameImageNotFound(t *testing.T) {
	images := newGameImages(newFakeImages(), discardLog())
	ctx := context.Background()
	for _, actor := range []domain.Actor{admin, nonAdmin} {
		_, setErr := images.Set(ctx, actor, gameID, "banner", jpegBytes)
		removeErr := images.Remove(ctx, actor, gameID, "banner")
		for name, err := range map[string]error{"set": setErr, "remove": removeErr} {
			if !errors.Is(err, domain.ErrGameImageNotFound) {
				t.Fatalf("%s as %+v: error %v; want ErrGameImageNotFound", name, actor, err)
			}
		}
	}
	if _, err := images.Image(ctx, gameID, "banner", ""); !errors.Is(err, domain.ErrGameImageNotFound) {
		t.Fatalf("image: error %v; want ErrGameImageNotFound", err)
	}
}

// The cover follows the same rules as the logo and is kept apart from it: each kind has its own version (ADR 0026).
func TestCoverIsAGameImageBesideTheLogo(t *testing.T) {
	var logged bytes.Buffer
	images := newFakeImages()
	gameImages := newGameImages(images, slog.New(slog.NewTextHandler(&logged, nil)))
	ctx := context.Background()
	if _, err := gameImages.Set(ctx, admin, gameID, "logo", jpegBytes); err != nil {
		t.Fatal(err)
	}
	if _, err := gameImages.Set(ctx, nonAdmin, gameID, "cover", jpegBytes); !errors.Is(err, domain.ErrNotAllowed) {
		t.Fatalf("non-admin: error %v; want ErrNotAllowed", err)
	}

	game, err := gameImages.Set(ctx, admin, gameID, "cover", append(bytes.Clone(jpegBytes), 2))

	logo, cover := images.images[gameID+"logo"], images.images[gameID+"cover"]
	if err != nil || game.CoverVersion == nil || *game.CoverVersion != cover.Version || game.LogoVersion == nil || *game.LogoVersion != logo.Version || cover.Version == logo.Version {
		t.Fatalf("game %+v, error %v; want the cover beside the logo", game, err)
	}
	if !strings.Contains(logged.String(), "kind=cover") {
		t.Fatalf("log %q, want kind=cover", logged.String())
	}
	if image, err := gameImages.Image(ctx, gameID, "cover", cover.Version); err != nil || !bytes.Equal(image.Data, cover.Data) {
		t.Fatalf("cover %+v, error %v", image, err)
	}
	if _, err := gameImages.Image(ctx, gameID, "cover", logo.Version); !errors.Is(err, domain.ErrGameImageNotFound) {
		t.Fatalf("cover at the logo version: error %v; want ErrGameImageNotFound", err)
	}
	if err := gameImages.Remove(ctx, admin, gameID, "cover"); err != nil {
		t.Fatal(err)
	}
	if _, ok := images.images[gameID+"logo"]; !ok || len(images.images) != 1 {
		t.Fatalf("images %+v; want only the logo left", images.images)
	}
}
