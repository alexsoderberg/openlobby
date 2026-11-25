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
	"openlobby/services/calendar/internal/domain"
	"openlobby/services/calendar/internal/infrastructure/authclient"
	"openlobby/services/calendar/internal/infrastructure/blizzard"
	"openlobby/services/calendar/internal/infrastructure/blizzardcache"
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
	blizzard       blizzard.Config
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
	if err := checkHTTPURL("AUTH_URL", cfg.authURL); err != nil {
		return cfg, err
	}
	cfg.blizzard, err = readBlizzardConfig()
	return cfg, err
}

// readBlizzardConfig reads the item catalog settings. Both client values empty disables the catalog; one of them empty
// is a mistake and stops the start (ADR 0029 section 4). Region and namespace are only needed with credentials.
func readBlizzardConfig() (blizzard.Config, error) {
	cfg := blizzard.Config{ClientID: os.Getenv("BLIZZARD_CLIENT_ID"), ClientSecret: os.Getenv("BLIZZARD_CLIENT_SECRET")}
	if cfg.ClientID == "" && cfg.ClientSecret == "" {
		return cfg, nil
	}
	if cfg.ClientID == "" || cfg.ClientSecret == "" {
		return cfg, errors.New("BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET must both be set or both be empty")
	}
	var err error
	if cfg.Region, err = config.String("BLIZZARD_REGION"); err != nil {
		return cfg, err
	}
	cfg.Namespace, err = config.String("BLIZZARD_NAMESPACE")
	return cfg, err
}

// itemCatalog returns the Blizzard catalog behind its cache, or one that is unavailable for every item when the
// catalog is disabled. The startup line names the namespace, which pins the data version (ADR 0029 section 4). The
// cache's sweep runs until ctx ends (ADR 0029 Amendment 2026-11-25 item 9).
func itemCatalog(ctx context.Context, cfg blizzard.Config, logger *slog.Logger) (application.ItemCatalog, error) {
	if cfg.ClientID == "" {
		logger.Warn("item catalog disabled", "reason", "BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET are empty")
		return disabledCatalog{}, nil
	}
	clock := systemclock.Clock{}
	catalog, err := blizzard.New(cfg, clock, logger)
	if err != nil {
		return nil, fmt.Errorf("BLIZZARD_REGION: %w", err)
	}
	logger.Info("item catalog enabled", "region", cfg.Region, "namespace", cfg.Namespace)
	cache := blizzardcache.New(catalog, clock)
	go cache.RunSweeps(ctx)
	return cache, nil
}

// disabledCatalog is unavailable for every item, so calendar runs without Blizzard credentials.
type disabledCatalog struct{}

func (disabledCatalog) Item(context.Context, domain.ItemID) (domain.CatalogItem, error) {
	return domain.CatalogItem{}, application.ErrCatalogUnavailable
}

func (disabledCatalog) ItemIcon(context.Context, domain.ItemID) (domain.ItemIcon, error) {
	return domain.ItemIcon{}, application.ErrCatalogUnavailable
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

	catalog, err := itemCatalog(ctx, cfg.blizzard, logger)
	if err != nil {
		return err
	}

	directory, err := authclient.New(cfg.authURL)
	if err != nil {
		return err
	}
	clock := systemclock.Clock{}
	repo := store.Groups()
	groups := application.NewGroups(repo, repo, repo, repo, directory, clock)
	invites := application.NewInviteLinks(repo, repo, store.InviteLinks(), cryptotoken.Generator{}, clock)
	games := application.NewGames(repo, store.Games(), store.Games(), logger)
	lobbies := application.NewLobbies(store.Lobbies(), store.Lobbies(), store.Games(), directory, clock)
	gameImages := application.NewGameImages(store.GameImages(), logger)
	items := application.NewItems(store.DropLists(), catalog, logger)
	handler := transport.NewRouter(groups, invites, games, gameImages, lobbies, application.NewMemberships(store.Memberships(), clock), application.NewPreferredGameRoles(store.PreferredGameRoles(), store.Games()), items, store.Ping, logger)
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
