// Command calendar runs the calendar service: serve (default), migrate up, migrate down, healthcheck (ADR 0008).
// This is the only place that reads the environment and wires the adapters (ADR 0008, CLAUDE.md).
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"openlobby/pkg/config"
	"openlobby/pkg/health"
	"openlobby/pkg/logging"
	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/infrastructure/authclient"
	"openlobby/services/calendar/internal/infrastructure/cryptotoken"
	"openlobby/services/calendar/internal/infrastructure/postgres"
	"openlobby/services/calendar/internal/infrastructure/systemclock"
	"openlobby/services/calendar/internal/transport"
)

const (
	usage = "usage: calendar [serve | migrate up | migrate down | healthcheck]"

	shutdownTimeout      = 10 * time.Second
	readHeaderTimeout    = 10 * time.Second
	writeTimeout         = 30 * time.Second
	idleTimeout          = 60 * time.Second
	migrationConnections = 1
)

var errUsage = errors.New(usage)

func main() {
	logger := logging.New(os.Stdout)
	// Shared infrastructure (pkg/httpapi) logs through the default logger, so it writes the same JSON lines.
	slog.SetDefault(logger)
	err := run(logger, os.Args[1:])
	switch {
	case errors.Is(err, errUsage):
		fmt.Fprintln(os.Stderr, usage)
		os.Exit(2)
	case err != nil:
		logger.Error("calendar stopped", "error", err.Error())
		os.Exit(1)
	}
}

// run dispatches to the subcommand. Without arguments the service starts (serve).
func run(logger *slog.Logger, args []string) error {
	switch subcommand(args) {
	case "serve":
		return serve(logger)
	case "migrate":
		return migrate(logger, args[1:])
	case "healthcheck":
		return healthcheck()
	default:
		return errUsage
	}
}

// subcommand returns the first argument, or "serve" when there is none.
func subcommand(args []string) string {
	if len(args) == 0 {
		return "serve"
	}
	return args[0]
}

func healthcheck() error {
	addr, err := config.String("HTTP_ADDR")
	if err != nil {
		return err
	}
	return health.Check(addr)
}

// migrateDirection reads the argument of `migrate`: "up" or "down". Anything else is a usage error.
func migrateDirection(args []string) (string, error) {
	if len(args) != 1 || (args[0] != "up" && args[0] != "down") {
		return "", errUsage
	}
	return args[0], nil
}

type serveConfig struct {
	httpAddr       string
	databaseURL    string
	maxConnections int
	authURL        string
}

func readServeConfig() (serveConfig, error) {
	var cfg serveConfig
	var err error
	if cfg.httpAddr, err = config.String("HTTP_ADDR"); err != nil {
		return cfg, err
	}
	if cfg.databaseURL, err = config.String("DATABASE_URL"); err != nil {
		return cfg, err
	}
	if cfg.maxConnections, err = config.PositiveInt("DATABASE_MAX_CONNECTIONS"); err != nil {
		return cfg, err
	}
	if cfg.authURL, err = config.String("AUTH_URL"); err != nil {
		return cfg, err
	}
	return cfg, checkHTTPURL("AUTH_URL", cfg.authURL)
}

// checkHTTPURL refuses a value that is not an absolute http or https URL with a host, so a typo fails at startup and
// not on the first lookup. The error names the variable, never its value.
func checkHTTPURL(name, value string) error {
	parsed, err := url.Parse(value)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return fmt.Errorf("%s must be an absolute http or https URL with a host", name)
	}
	return nil
}

// serve starts answering at once. A database that is not ready yet shows as not ready on /readyz, and Compose
// restarts the container when it stops (ADR 0008).
func serve(logger *slog.Logger) error {
	cfg, err := readServeConfig()
	if err != nil {
		return err
	}
	store, err := postgres.Open(cfg.databaseURL, cfg.maxConnections)
	if err != nil {
		return err
	}
	defer closeOrLog(logger, "database", store)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	directory, err := authclient.New(cfg.authURL)
	if err != nil {
		return err
	}
	clock := systemclock.Clock{}
	repo := store.Groups()
	groups := application.NewGroups(repo, repo, repo, directory, clock)
	invites := application.NewInviteLinks(repo, repo, store.InviteLinks(), cryptotoken.Generator{}, clock)
	games := application.NewGames(repo, store.Games())
	handler := transport.NewRouter(groups, invites, games, store.Ping, logger)
	return listen(ctx, logger, cfg.httpAddr, handler)
}

// listen serves until the context is cancelled (SIGTERM), then stops accepting calls and finishes the open ones.
func listen(ctx context.Context, logger *slog.Logger, addr string, handler http.Handler) error {
	server := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		WriteTimeout:      writeTimeout,
		IdleTimeout:       idleTimeout,
	}
	serveErr := make(chan error, 1)
	go func() { serveErr <- server.ListenAndServe() }()
	logger.InfoContext(ctx, "calendar listening", "addr", addr)

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}
	logger.InfoContext(ctx, "calendar shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	return server.Shutdown(shutdownCtx)
}

// closeOrLog closes a resource when the process ends. Nothing else can report a failure at that point.
func closeOrLog(logger *slog.Logger, resource string, closer io.Closer) {
	if err := closer.Close(); err != nil {
		logger.Error("close failed", "resource", resource, "error", err.Error())
	}
}

func migrate(logger *slog.Logger, args []string) error {
	direction, err := migrateDirection(args)
	if err != nil {
		return err
	}
	databaseURL, err := config.String("DATABASE_URL")
	if err != nil {
		return err
	}
	store, err := postgres.Open(databaseURL, migrationConnections)
	if err != nil {
		return err
	}
	defer closeOrLog(logger, "database", store)

	ctx := context.Background()
	if err := store.Migrate(ctx, direction == "down"); err != nil {
		return fmt.Errorf("migrate %s: %w", direction, err)
	}
	logger.InfoContext(ctx, "migrations applied", "direction", direction)
	return nil
}
