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
			handler := Middleware(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				seen = FromContext(r.Context())
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
			if tc.wantKept && seen != tc.headers[0] {
				t.Fatalf("got %q, want the incoming ID", seen)
			}
			if !tc.wantKept && (seen == "" || seen == tc.headers[0]) {
				t.Fatalf("got %q, want a newly generated ID", seen)
			}
		})
	}
}
