package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"time"
)

// loopbackFreePort asks the system for a free port (":0"), so that a test never collides with another process.
const loopbackFreePort = "127.0.0.1:0"

// listenStopTimeout bounds how long a test waits for listen to return after cancellation.
const listenStopTimeout = 5 * time.Second

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestMigrateDirection(t *testing.T) {
	tests := []struct {
		name    string
		args    []string
		want    string
		wantErr bool
	}{
		{name: "up", args: []string{"up"}, want: "up"},
		{name: "down", args: []string{"down"}, want: "down"},
		{name: "missing argument", args: nil, wantErr: true},
		{name: "unknown direction", args: []string{"sideways"}, wantErr: true},
		{name: "extra argument", args: []string{"up", "now"}, wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := migrateDirection(tc.args)
			if tc.wantErr {
				if !errors.Is(err, errUsage) {
					t.Fatalf("error %v, want usage error", err)
				}
				return
			}
			if err != nil || got != tc.want {
				t.Fatalf("direction %q, error %v; want %q", got, err, tc.want)
			}
		})
	}
}

func TestRunRejectsUnknownSubcommandAndBadMigrateArgument(t *testing.T) {
	for _, args := range [][]string{{"nope"}, {"migrate"}, {"migrate", "sideways"}} {
		if err := run(discardLogger(), args); !errors.Is(err, errUsage) {
			t.Errorf("run(%v) = %v, want usage error", args, err)
		}
	}
}

func TestHealthcheckNeedsHTTPAddr(t *testing.T) {
	t.Setenv("HTTP_ADDR", "")

	err := run(discardLogger(), []string{"healthcheck"})

	if err == nil || errors.Is(err, errUsage) {
		t.Fatalf("error %v, want the missing HTTP_ADDR error", err)
	}
}

// A SIGTERM during startup cancels the context before the server runs. listen must then return nil (exit 0).
func TestListenReturnsNilWhenContextIsCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- listen(ctx, discardLogger(), loopbackFreePort, http.NotFoundHandler()) }()
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("listen returned %v, want nil", err)
		}
	case <-time.After(listenStopTimeout):
		t.Fatal("listen did not return after the context was cancelled")
	}
}

// setServeEnv sets the variables that readServeConfig reads, with the given AUTH_URL.
func setServeEnv(t *testing.T, authURL string) {
	t.Helper()
	t.Setenv("HTTP_ADDR", "0.0.0.0:8080")
	t.Setenv("DATABASE_URL", "postgres://calendar@localhost/calendar")
	t.Setenv("DATABASE_MAX_CONNECTIONS", "5")
	t.Setenv("AUTH_URL", authURL)
}

// AUTH_URL is required at startup: calendar reads member names from auth, so it refuses to start without it.
func TestReadServeConfigNeedsAuthURL(t *testing.T) {
	setServeEnv(t, "")

	_, err := readServeConfig()

	if err == nil || !strings.Contains(err.Error(), "AUTH_URL") {
		t.Fatalf("error %v, want the missing AUTH_URL error", err)
	}
}

// AUTH_URL must be an absolute http or https URL with a host, so a typo fails at startup and not on the first lookup.
func TestReadServeConfigRejectsMalformedAuthURL(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		wantErr bool
	}{
		{name: "http with host", value: "http://auth:8080"},
		{name: "https with host", value: "https://auth.example.com"},
		{name: "no scheme", value: "auth:8080", wantErr: true},
		{name: "other scheme", value: "ftp://auth:8080", wantErr: true},
		{name: "no host", value: "http:///internal", wantErr: true},
		{name: "not parseable", value: "http://[::1", wantErr: true},
		{name: "relative path", value: "/auth", wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			setServeEnv(t, tc.value)

			_, err := readServeConfig()

			if (err != nil) != tc.wantErr || (err != nil && !strings.Contains(err.Error(), "AUTH_URL")) {
				t.Fatalf("error %v, want an AUTH_URL error when wantErr is %v", err, tc.wantErr)
			}
		})
	}
}
