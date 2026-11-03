// Package cryptotoken implements application.TokenGenerator with crypto/rand (ADR 0007).
package cryptotoken

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

// tokenBytes is the entropy of a token: 32 random bytes (ADR 0007).
const tokenBytes = 32

// Generator returns random tokens, base64url without padding (43 characters).
type Generator struct{}

// NewToken returns a new random token.
func (Generator) NewToken() (string, error) {
	buf := make([]byte, tokenBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
