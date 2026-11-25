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

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/infrastructure/blizzard"
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
	t.Setenv("BLIZZARD_CLIENT_ID", "")
	t.Setenv("BLIZZARD_CLIENT_SECRET", "")
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

// Both client values empty disables the catalog with a warning; one of them empty, or a wrong region, stops the start
// (ADR 0029 section 4).
func TestTheItemCatalogSettings(t *testing.T) {
	tests := []struct {
		name, id, secret, region, wantErr string
	}{
		{name: "disabled", wantErr: ""},
		{name: "only the id", id: "id", region: "eu", wantErr: "BLIZZARD_CLIENT_SECRET"},
		{name: "only the secret", secret: "secret", region: "eu", wantErr: "BLIZZARD_CLIENT_ID"},
		{name: "no region", id: "id", secret: "secret", wantErr: "BLIZZARD_REGION"},
		{name: "unknown region", id: "id", secret: "secret", region: "cn", wantErr: "BLIZZARD_REGION"},
		{name: "enabled", id: "id", secret: "secret", region: "eu", wantErr: ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			setServeEnv(t, "http://auth:8080")
			t.Setenv("BLIZZARD_CLIENT_ID", tc.id)
			t.Setenv("BLIZZARD_CLIENT_SECRET", tc.secret)
			t.Setenv("BLIZZARD_REGION", tc.region)
			t.Setenv("BLIZZARD_NAMESPACE", "static-forever-eu")

			cfg, err := readServeConfig()
			if err == nil {
				_, err = itemCatalog(t.Context(), cfg.blizzard, discardLogger())
			}

			if (tc.wantErr == "") != (err == nil) || (err != nil && !strings.Contains(err.Error(), tc.wantErr)) {
				t.Fatalf("error %v, want one naming %q", err, tc.wantErr)
			}
		})
	}
}

func TestTheDisabledCatalogIsUnavailable(t *testing.T) {
	catalog, err := itemCatalog(t.Context(), blizzard.Config{}, discardLogger())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := catalog.Item(context.Background(), 1); !errors.Is(err, application.ErrCatalogUnavailable) {
		t.Fatalf("item: %v; want ErrCatalogUnavailable", err)
	}
	if _, err := catalog.ItemIcon(context.Background(), 1); !errors.Is(err, application.ErrCatalogUnavailable) {
		t.Fatalf("icon: %v; want ErrCatalogUnavailable", err)
	}
}
