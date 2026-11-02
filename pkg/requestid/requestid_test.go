package requestid

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMiddlewareKeepsOnlyValidIDs(t *testing.T) {
	tests := []struct {
		name     string
		headers  []string
		wantKept bool
	}{
		{name: "valid ID is kept", headers: []string{"abc-123"}, wantKept: true},
		{name: "ID of 64 characters is kept", headers: []string{strings.Repeat("a", 64)}, wantKept: true},
		{name: "ID over 64 characters is replaced", headers: []string{strings.Repeat("a", 65)}},
		{name: "ID with a space is replaced", headers: []string{"abc def"}},
		{name: "ID with an underscore is replaced", headers: []string{"abc_def"}},
		{name: "two values are replaced", headers: []string{"abc", "def"}},
		{name: "empty value is replaced", headers: []string{""}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var seen string
			var forwarded []string
			handler := Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				seen = FromContext(r.Context())
				forwarded = r.Header.Values(Header)
			}))
			request := httptest.NewRequest(http.MethodGet, "/", nil)
			for _, value := range tc.headers {
				request.Header.Add(Header, value)
			}
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)

			if response.Header().Get(Header) != seen {
				t.Fatalf("response header %q differs from context %q", response.Header().Get(Header), seen)
			}
			if len(forwarded) != 1 || forwarded[0] != seen {
				t.Fatalf("request header values %v, want exactly one equal to the context ID %q", forwarded, seen)
			}
			if tc.wantKept && seen != tc.headers[0] {
				t.Fatalf("got %q, want the incoming ID", seen)
			}
			if !tc.wantKept && (seen == "" || seen == tc.headers[0]) {
				t.Fatalf("got %q, want a newly generated ID", seen)
			}
		})
	}
}

// TestMiddlewareReplacesRequestHeaderWithSingleValue checks ADR 0001 (REQ-0001 calendar, item 1): the generated
// binding must see exactly one value, so a duplicate header is replaced and not rejected.
func TestMiddlewareReplacesRequestHeaderWithSingleValue(t *testing.T) {
	var values []string
	var seen string
	handler := Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		values = r.Header.Values(Header)
		seen = FromContext(r.Context())
	}))
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Add(Header, "abc")
	request.Header.Add(Header, "def")
	handler.ServeHTTP(httptest.NewRecorder(), request)

	if len(values) != 1 || values[0] != seen || seen == "" {
		t.Fatalf("request header values %v, context %q: want exactly one, equal to the context ID", values, seen)
	}
	if values[0] == "abc" || values[0] == "def" {
		t.Fatalf("duplicate header kept an incoming value: %q", values[0])
	}
}
