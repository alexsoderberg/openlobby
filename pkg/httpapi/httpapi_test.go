package httpapi

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIsUUID(t *testing.T) {
	tests := map[string]bool{
		"0b8e3f7a-1c2d-4e5f-8a9b-0c1d2e3f4a5b": true,
		"0B8E3F7A-1C2D-4E5F-8A9B-0C1D2E3F4A5B": false,
		"not-a-uuid":                           false,
		"":                                     false,
	}
	for value, want := range tests {
		if got := IsUUID(value); got != want {
			t.Errorf("IsUUID(%q) = %v, want %v", value, got, want)
		}
	}
}

func TestLimitBodyRejectsLargeBody(t *testing.T) {
	handler := LimitBody(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		if _, err := io.ReadAll(r.Body); err == nil {
			t.Error("read of an oversized body succeeded")
		}
	}))
	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(strings.Repeat("x", MaxBodyBytes+1)))
	handler.ServeHTTP(httptest.NewRecorder(), request)
}

func TestInvalidRequestHandlerWritesEnvelopeWithoutDetails(t *testing.T) {
	response := httptest.NewRecorder()
	InvalidRequestHandler(response, httptest.NewRequest(http.MethodPost, "/", nil), io.ErrUnexpectedEOF)

	if response.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", response.Code)
	}
	if body := response.Body.String(); body != `{"error":{"code":"invalid_request","requestId":""}}`+"\n" {
		t.Fatalf("body %q", body)
	}
}
