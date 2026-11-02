// Command gateway runs the gateway: serve (default) or healthcheck (ADR 0008). It has no database, so no migrate.
// This is the only place that reads the environment and wires the adapters (ADR 0008, CLAUDE.md).
package main

import (
	"context"
	"errors"
	"fmt"
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
	"openlobby/services/gateway/internal/infrastructure/authclient"
	"openlobby/services/gateway/internal/transport"
)

const (
	usage = "usage: gateway [serve | healthcheck]"

	// validateTimeout bounds one session check with auth (ADR 0002 review 5).
	validateTimeout   = 5 * time.Second
	shutdownTimeout   = 10 * time.Second
	readHeaderTimeout = 10 * time.Second
	writeTimeout      = 30 * time.Second
	idleTimeout       = 60 * time.Second
)

var errUsage = errors.New(usage)

func main() {
	logger := logging.New(os.Stdout)
	slog.SetDefault(logger)
	err := run(logger, os.Args[1:])
	switch {
	case errors.Is(err, errUsage):
		if _, printErr := fmt.Fprintln(os.Stderr, usage); printErr != nil {
			logger.Error("write usage failed", "error", printErr.Error())
		}
		os.Exit(2)
	case err != nil:
		logger.Error("gateway stopped", "error", err.Error())
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
	httpAddr  string
	upstreams transport.Upstreams
}

func readServeConfig() (serveConfig, error) {
	var cfg serveConfig
	var err error
	if cfg.httpAddr, err = config.String("HTTP_ADDR"); err != nil {
		return cfg, err
	}
	if cfg.upstreams.Auth, err = readBaseURL("AUTH_URL"); err != nil {
		return cfg, err
	}
	if cfg.upstreams.Calendar, err = readBaseURL("CALENDAR_URL"); err != nil {
		return cfg, err
	}
	cfg.upstreams.Frontend, err = readBaseURL("FRONTEND_URL")
	return cfg, err
}

// readBaseURL returns a required base URL with a scheme and a host. The error names the variable, never its value.
func readBaseURL(name string) (*url.URL, error) {
	raw, err := config.String(name)
	if err != nil {
		return nil, err
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("%s must be an absolute URL", name)
	}
	return parsed, nil
}

func serve(logger *slog.Logger) error {
	cfg, err := readServeConfig()
	if err != nil {
		return err
	}
	sessions, err := authclient.New(cfg.upstreams.Auth.String(), validateTimeout)
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()
	handler := transport.NewRouter(sessions, cfg.upstreams, logger)
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
	logger.InfoContext(ctx, "gateway listening", "addr", addr)

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}
	logger.InfoContext(ctx, "gateway shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	return server.Shutdown(shutdownCtx)
}
