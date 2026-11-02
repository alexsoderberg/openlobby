package application

import (
	"crypto/sha256"
	"encoding/base64"
)

// hashSecret stores a high-entropy token as SHA-256 (ADR 0005). A password hash would be the wrong tool here.
func hashSecret(secret string) []byte {
	sum := sha256.Sum256([]byte(secret))
	return sum[:]
}

// pkceChallenge is the S256 code challenge of RFC 7636: base64url(SHA-256(verifier)) without padding.
func pkceChallenge(codeVerifier string) string {
	sum := sha256.Sum256([]byte(codeVerifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
