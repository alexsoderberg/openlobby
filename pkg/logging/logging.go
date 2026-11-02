// Package logging builds the structured JSON logger that every service writes to stdout (ADR 0008).
package logging

import (
	"context"
	"io"
	"log/slog"

	"openlobby/pkg/requestid"
)

// New returns a JSON logger that adds the request ID of the context to every record.
func New(w io.Writer) *slog.Logger {
	return slog.New(requestIDHandler{slog.NewJSONHandler(w, nil)})
}

type requestIDHandler struct {
	slog.Handler
}

func (h requestIDHandler) Handle(ctx context.Context, record slog.Record) error {
	if id := requestid.FromContext(ctx); id != "" {
		record.AddAttrs(slog.String("requestId", id))
	}
	return h.Handler.Handle(ctx, record)
}

func (h requestIDHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return requestIDHandler{h.Handler.WithAttrs(attrs)}
}

func (h requestIDHandler) WithGroup(name string) slog.Handler {
	return requestIDHandler{h.Handler.WithGroup(name)}
}
