package cryptotoken

import (
	"encoding/base64"
	"testing"
)

func TestNewTokenIsURLSafeAnd32Bytes(t *testing.T) {
	token, err := Generator{}.NewToken()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		t.Fatalf("token %q is not base64url: %v", token, err)
	}
	if len(raw) != tokenBytes {
		t.Fatalf("token holds %d bytes, want %d", len(raw), tokenBytes)
	}
	other, _ := Generator{}.NewToken()
	if other == token {
		t.Fatal("two tokens are equal")
	}
}
