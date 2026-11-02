// Package health serves /healthz and /readyz and checks readiness from the healthcheck subcommand (ADR 0008).
package health

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"
)

// Timeout bounds the readiness check; it stays below the Compose healthcheck timeout of 3 seconds (ADR 0008).
const Timeout = 2 * time.Second

// Register adds /healthz (process alive) and /readyz (the service's own database answers) to mux.
func Register(mux *http.ServeMux, ready func(context.Context) error) {
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), Timeout)
		defer cancel()
		if err := ready(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	})
}

// Check calls /readyz on the local port of listenAddress (the HTTP_ADDR value). It returns nil on status 200.
func Check(listenAddress string) (err error) {
	_, port, err := net.SplitHostPort(listenAddress)
	if err != nil {
		return fmt.Errorf("parse listen address: %w", err)
	}
	client := http.Client{Timeout: Timeout}
	response, err := client.Get("http://" + net.JoinHostPort("127.0.0.1", port) + "/readyz")
	if err != nil {
		return fmt.Errorf("readiness request: %w", err)
	}
	defer func() { err = errors.Join(err, response.Body.Close()) }()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("readiness status %d", response.StatusCode)
	}
	return nil
}
