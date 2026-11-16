package domain

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"slices"
)

// MaxGameImageBytes is the largest game image (512 KiB, REQ-0026). The database check mirrors it (ADR 0026 point 6).
const MaxGameImageBytes = 512 << 10

// ErrImageTooLarge means the image has more than MaxGameImageBytes.
var ErrImageTooLarge = errors.New("image too large")

// ErrImageType means the bytes are not PNG, JPEG or WebP.
var ErrImageType = errors.New("invalid image type")

// ErrGameImageNotFound means the kind is unknown, or the game has no image of the kind at the asked version (ADR 0026 points 3, 4).
var ErrGameImageNotFound = errors.New("game image not found")

// gameImageKinds are the kinds the API accepts. The database also allows "cover", which PR2 adds here (ADR 0026).
var gameImageKinds = []string{"logo"}

// CheckGameImageKind gives ErrGameImageNotFound for a kind that is not a game image kind (ADR 0026 point 3).
func CheckGameImageKind(kind string) error {
	if !slices.Contains(gameImageKinds, kind) {
		return ErrGameImageNotFound
	}
	return nil
}

// GameImage is a logo or cover of a game (ADR 0026). Version is the hex SHA-256 of Data.
type GameImage struct {
	Kind      string
	MediaType string
	Version   string
	Data      []byte
}

// The first bytes of each allowed type. SVG is never allowed, because it can carry script.
var (
	pngSignature  = []byte("\x89PNG\r\n\x1a\n")
	jpegSignature = []byte{0xff, 0xd8, 0xff}
)

// webpHeaderLength covers "RIFF", the four length bytes and "WEBP".
const webpHeaderLength = 12

// NewGameImage checks the kind, the size, then the type by the bytes; the request's Content-Type is never used (ADR 0026 point 6).
// shortcut: no decode, dimensions unchecked, upgrade with a stdlib image.DecodeConfig check (PNG and JPEG) and a WebP header parse if a viewer's browser is slow or fails.
func NewGameImage(kind string, data []byte) (GameImage, error) {
	if err := CheckGameImageKind(kind); err != nil {
		return GameImage{}, err
	}
	if len(data) > MaxGameImageBytes {
		return GameImage{}, ErrImageTooLarge
	}
	mediaType, ok := sniffGameImage(data)
	if !ok {
		return GameImage{}, ErrImageType
	}
	sum := sha256.Sum256(data)
	return GameImage{Kind: kind, MediaType: mediaType, Version: hex.EncodeToString(sum[:]), Data: data}, nil
}

func sniffGameImage(data []byte) (string, bool) {
	switch {
	case bytes.HasPrefix(data, pngSignature):
		return "image/png", true
	case bytes.HasPrefix(data, jpegSignature):
		return "image/jpeg", true
	case len(data) >= webpHeaderLength && string(data[:4]) == "RIFF" && string(data[8:12]) == "WEBP":
		return "image/webp", true
	}
	return "", false
}
