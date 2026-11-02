// Command auth runs the auth service: serve (default), migrate up, migrate down, healthcheck (ADR 0008).
// This is the only place that reads the environment and wires the adapters (ADR 0008, CLAUDE.md).
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"openlobby/pkg/config"
	"openlobby/pkg/health"
	"openlobby/pkg/logging"
	"openlobby/services/auth/internal/application"
	"openlobby/services/auth/internal/domain"
	"openlobby/services/auth/internal/infrastructure/cryptotoken"
	"openlobby/services/auth/internal/infrastructure/discord"
	"openlobby/services/auth/internal/infrastructure/postgres"
	"openlobby/services/auth/internal/infrastructure/systemclock"
	"openlobby/services/auth/internal/transport"
)

const (
	usage = "usage: auth [serve | migrate up | migrate down | healthcheck]"

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
		logger.Error("auth stopped", "error", err.Error())
		os.Exit(1)
	}
}

func run(logger *slog.Logger, args []string) error {
	if len(args) == 0 {
		return serve(logger)
	}
	switch args[0] {
	case "serve":
		return serve(logger)
	case "migrate":
		return migrate(logger, args[1:])
	case "healthcheck":
		addr, err := config.String("HTTP_ADDR")
		if err != nil {
			return err
		}
		return health.Check(addr)
	default:
		return errUsage
	}
}

type serveConfig struct {
	httpAddr       string
	databaseURL    string
	maxConnections int
	discord        discord.Config
	admins         domain.SystemAdmins
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
	if cfg.discord.ClientID, err = config.String("DISCORD_CLIENT_ID"); err != nil {
		return cfg, err
	}
	if cfg.discord.ClientSecret, err = config.String("DISCORD_CLIENT_SECRET"); err != nil {
		return cfg, err
	}
	if cfg.discord.RedirectURI, err = config.String("DISCORD_REDIRECT_URI"); err != nil {
		return cfg, err
	}
	cfg.admins, err = domain.ParseSystemAdmins(os.Getenv("SYSTEM_ADMINS"), []string{discord.ProviderName})
	return cfg, err
}

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

	auth := application.NewAuth(application.Ports{
		Identity: discord.New(cfg.discord),
		Users:    store.Users(),
		Sessions: store.Sessions(),
		Attempts: store.Attempts(),
		Tx:       store,
		Clock:    systemclock.Clock{},
		Tokens:   cryptotoken.Generator{},
		Admins:   cfg.admins,
	}, logger)
	handler := transport.NewRouter(auth, store.Ping, logger)
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
	logger.InfoContext(ctx, "auth listening", "addr", addr)

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}
	logger.InfoContext(ctx, "auth shutting down")
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
	if len(args) != 1 || (args[0] != "up" && args[0] != "down") {
		return errUsage
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
	if err := store.Migrate(ctx, args[0] == "down"); err != nil {
		return fmt.Errorf("migrate %s: %w", args[0], err)
	}
	logger.InfoContext(ctx, "migrations applied", "direction", args[0])
	return nil
}
