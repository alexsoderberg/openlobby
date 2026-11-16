package domain_test

import (
	"bytes"
	"errors"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

var (
	pngHeader  = []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 13, 'I', 'H', 'D', 'R'}
	jpegHeader = []byte{0xff, 0xd8, 0xff, 0xe0, 0, 16, 'J', 'F', 'I', 'F'}
	webpHeader = []byte("RIFF\x24\x00\x00\x00WEBPVP8 ")
)

// The type comes from the first bytes only (ADR 0026 point 6). SVG, GIF, HTML and text are refused.
func TestNewGameImageSniffsTheTypeFromTheBytes(t *testing.T) {
	tests := []struct {
		name string
		data []byte
		want string
	}{
		{name: "png", data: pngHeader, want: "image/png"},
		{name: "jpeg", data: jpegHeader, want: "image/jpeg"},
		{name: "webp", data: webpHeader, want: "image/webp"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			image, err := domain.NewGameImage("logo", tc.data)

			if err != nil || image.MediaType != tc.want || image.Kind != "logo" {
				t.Fatalf("image %+v, error %v; want %s", image, err, tc.want)
			}
		})
	}
}

func TestNewGameImageRefusesOtherBytes(t *testing.T) {
	tests := []struct {
		name string
		data []byte
	}{
		{name: "empty", data: nil},
		{name: "gif", data: []byte("GIF89a\x01\x00\x01\x00")},
		{name: "svg", data: []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)},
		{name: "html", data: []byte("<!DOCTYPE html><html></html>")},
		{name: "text", data: []byte("just text, named logo.png")},
		{name: "truncated png signature", data: pngHeader[:7]},
		{name: "riff that is not webp", data: []byte("RIFF\x24\x00\x00\x00WAVEfmt ")},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := domain.NewGameImage("logo", tc.data); !errors.Is(err, domain.ErrImageType) {
				t.Fatalf("error %v; want ErrImageType", err)
			}
		})
	}
}

// The size is checked before the type, so a large file of any kind is too large (ADR 0026 point 6).
func TestNewGameImageSizeLimit(t *testing.T) {
	atLimit := append(bytes.Clone(pngHeader), make([]byte, 524288-len(pngHeader))...)
	if _, err := domain.NewGameImage("logo", atLimit); err != nil {
		t.Fatalf("524288 bytes: error %v; want none", err)
	}
	for name, data := range map[string][]byte{"png": append(atLimit, 0), "text": make([]byte, 524289)} {
		if _, err := domain.NewGameImage("logo", data); !errors.Is(err, domain.ErrImageTooLarge) {
			t.Fatalf("524289 bytes of %s: error %v; want ErrImageTooLarge", name, err)
		}
	}
}

// The version is the lowercase hex SHA-256 of the bytes, so it changes with the content and only with it.
func TestNewGameImageVersionIsTheSHA256OfTheBytes(t *testing.T) {
	image, err := domain.NewGameImage("logo", []byte{0xff, 0xd8, 0xff})
	if err != nil {
		t.Fatal(err)
	}
	// sha256 of ff d8 ff, computed with `printf '\xff\xd8\xff' | sha256sum`.
	const want = "6e568e1f67fba258184c78181539e5e8fdee447e49bb706fc0ea34fbf12336a5"
	if image.Version != want {
		t.Fatalf("version %s; want %s", image.Version, want)
	}
}

// Only the kinds of the API are game images; an unknown kind is game_image_not_found, before the bytes are checked.
func TestNewGameImageRefusesAnUnknownKind(t *testing.T) {
	for _, kind := range []string{"", "banner", "Logo", "cover"} {
		if _, err := domain.NewGameImage(kind, []byte("text")); !errors.Is(err, domain.ErrGameImageNotFound) {
			t.Fatalf("kind %q: error %v; want ErrGameImageNotFound", kind, err)
		}
	}
}
