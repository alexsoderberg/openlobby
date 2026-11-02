package authclient

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"openlobby/pkg/requestid"
	"openlobby/services/gateway/internal/application"
)

const (
	testToken     = "session-secret"
	testUserID    = "0f8c2d4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"
	testTimeout   = 2 * time.Second
	shortTimeout  = 50 * time.Millisecond
	testRequestID = "req-123"
)

// recorded holds what the stub auth service received.
type recorded struct {
	path      string
	token     string
	requestID string
}

// newStub starts a fake auth service with the given status and body. It records the request.
func newStub(t *testing.T, status int, body string, got *recorded) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got.path = r.Method + " " + r.URL.Path
		got.requestID = r.Header.Get(requestid.Header)
		var sent struct {
			Token string `json:"token"`
		}
		if err := json.NewDecoder(r.Body).Decode(&sent); err != nil {
			http.Error(w, "bad body", http.StatusBadRequest)
			return
		}
		got.token = sent.Token
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if _, err := io.WriteString(w, body); err != nil {
			t.Errorf("write stub body: %v", err)
		}
	}))
}

func newClient(t *testing.T, baseURL string, timeout time.Duration) *Client {
	t.Helper()
	client, err := New(baseURL, timeout)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return client
}

// authAnswer is one answer of auth and the outcome the adapter must give for it.
type authAnswer struct {
	name      string
	status    int
	body      string
	want      application.Session
	wantErr   error
	wantOther bool
}

var authAnswers = []authAnswer{
	{
		name:   "valid session",
		status: http.StatusOK,
		body:   `{"userId":"` + testUserID + `","isSystemAdmin":true}`,
		want:   application.Session{UserID: testUserID, IsSystemAdmin: true},
	},
	{
		name:    "unknown or expired session",
		status:  http.StatusUnauthorized,
		body:    `{"error":{"code":"unauthenticated","requestId":"r"}}`,
		wantErr: application.ErrUnauthenticated,
	},
	{
		name:    "auth database does not answer",
		status:  http.StatusServiceUnavailable,
		body:    `{"error":{"code":"service_unavailable","requestId":"r"}}`,
		wantErr: application.ErrUnavailable,
	},
	{
		name:      "auth internal error is not unavailable",
		status:    http.StatusInternalServerError,
		body:      `{"error":{"code":"internal_error","requestId":"r"}}`,
		wantOther: true,
	},
}

func TestValidateMapsAuthAnswers(t *testing.T) {
	for _, answer := range authAnswers {
		t.Run(answer.name, func(t *testing.T) {
			var got recorded
			stub := newStub(t, answer.status, answer.body, &got)
			defer stub.Close()
			session, err := newClient(t, stub.URL, testTimeout).Validate(context.Background(), testToken)
			assertOutcome(t, session, err, answer)
		})
	}
}

func assertOutcome(t *testing.T, session application.Session, err error, answer authAnswer) {
	t.Helper()
	switch {
	case answer.wantOther:
		if err == nil || errors.Is(err, application.ErrUnauthenticated) || errors.Is(err, application.ErrUnavailable) {
			t.Errorf("err = %v, want an error that is neither unauthenticated nor unavailable", err)
		}
	case answer.wantErr != nil:
		if !errors.Is(err, answer.wantErr) {
			t.Errorf("err = %v, want %v", err, answer.wantErr)
		}
	case err != nil:
		t.Fatalf("unexpected error: %v", err)
	case session != answer.want:
		t.Errorf("session = %+v, want %+v", session, answer.want)
	}
}

func TestValidateSendsTokenAndRequestIDToAuth(t *testing.T) {
	var got recorded
	stub := newStub(t, http.StatusUnauthorized, `{"error":{"code":"unauthenticated","requestId":"r"}}`, &got)
	defer stub.Close()
	client := newClient(t, stub.URL, testTimeout)
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(requestid.Header, testRequestID)
	handler := requestid.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := client.Validate(r.Context(), testToken); !errors.Is(err, application.ErrUnauthenticated) {
			t.Errorf("err = %v, want ErrUnauthenticated", err)
		}
	}))
	handler.ServeHTTP(httptest.NewRecorder(), request)
	if got.path != "POST /internal/sessions/validate" {
		t.Errorf("path = %q", got.path)
	}
	if got.token != testToken {
		t.Errorf("token not passed on")
	}
	if got.requestID != testRequestID {
		t.Errorf("X-Request-Id = %q, want %q", got.requestID, testRequestID)
	}
}

func TestValidateIsUnavailableWhenAuthIsDown(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	address := listener.Addr().String()
	if err := listener.Close(); err != nil {
		t.Fatalf("close listener: %v", err)
	}
	_, err = newClient(t, "http://"+address, testTimeout).Validate(context.Background(), testToken)
	if !errors.Is(err, application.ErrUnavailable) {
		t.Errorf("err = %v, want ErrUnavailable", err)
	}
}

func TestValidateIsUnavailableAfterTimeout(t *testing.T) {
	stub := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		// The body is read first: the server notices a closed connection only after that.
		if _, err := io.Copy(io.Discard, r.Body); err != nil {
			return
		}
		<-r.Context().Done()
	}))
	defer stub.Close()
	_, err := newClient(t, stub.URL, shortTimeout).Validate(context.Background(), testToken)
	if !errors.Is(err, application.ErrUnavailable) {
		t.Errorf("err = %v, want ErrUnavailable", err)
	}
}
