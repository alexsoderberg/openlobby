package transport

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"

	"openlobby/pkg/httpapi"
	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// setGameImagePattern is the one route whose body may be larger than httpapi.MaxBodyBytes (ADR 0026 point 9).
const setGameImagePattern = http.MethodPut + " /api/games/{gameId}/images/{kind}"

// gameImageCacheControl is safe because the URL names the content: a new upload has a new version (ADR 0026 point 4).
const gameImageCacheControl = "private, max-age=31536000, immutable"

const noSniff = "nosniff"

// limitBody applies the 16 KiB limit of ADR 0001 to every route except the image upload, which bounds its own read.
func limitBody(next http.Handler) http.Handler {
	limited := httpapi.LimitBody(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Pattern == setGameImagePattern {
			next.ServeHTTP(w, r)
			return
		}
		limited.ServeHTTP(w, r)
	})
}

// SetGameImage stores the uploaded image. The read stops one byte over the limit, so memory is bounded for any caller
// and a larger body is still seen as too large. The Content-Type of the request is ignored (ADR 0026 point 6).
func (h publicHandler) SetGameImage(ctx context.Context, request publicapi.SetGameImageRequestObject) (publicapi.SetGameImageResponseObject, error) {
	// The kind is a path check, so it comes before the body is read (ADR 0026 Amendment 2026-11-16 item 6).
	if err := domain.CheckGameImageKind(string(request.Kind)); err != nil {
		return publicapi.SetGameImage404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameImageNotFound)}, nil
	}
	data, err := io.ReadAll(io.LimitReader(request.Body, domain.MaxGameImageBytes+1))
	if err != nil {
		return publicapi.SetGameImage400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidRequest)}, nil
	}
	game, err := h.gameImages.Set(ctx, actorFrom(ctx), request.GameId, string(request.Kind), data)
	switch {
	case errors.Is(err, domain.ErrGameImageNotFound):
		return publicapi.SetGameImage404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameImageNotFound)}, nil
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.SetGameImage403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case errors.Is(err, domain.ErrImageTooLarge):
		return publicapi.SetGameImage413JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeImageTooLarge)}, nil
	case errors.Is(err, domain.ErrImageType):
		return publicapi.SetGameImage400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidImageType)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.SetGameImage404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case err != nil:
		return nil, err
	}
	body, err := gameBody(game)
	if err != nil {
		return nil, err
	}
	return publicapi.SetGameImage200JSONResponse(body), nil
}

// RemoveGameImage removes the image of the kind; no image is also 204.
func (h publicHandler) RemoveGameImage(ctx context.Context, request publicapi.RemoveGameImageRequestObject) (publicapi.RemoveGameImageResponseObject, error) {
	err := h.gameImages.Remove(ctx, actorFrom(ctx), request.GameId, string(request.Kind))
	switch {
	case errors.Is(err, domain.ErrGameImageNotFound):
		return publicapi.RemoveGameImage404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameImageNotFound)}, nil
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.RemoveGameImage403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.RemoveGameImage404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.RemoveGameImage204Response{}, nil
}

// GetGameImage sends the image at its current version to any logged-in user. Every other case is the same 404, which
// carries no caching header (ADR 0026 point 4).
func (h publicHandler) GetGameImage(ctx context.Context, request publicapi.GetGameImageRequestObject) (publicapi.GetGameImageResponseObject, error) {
	version := ""
	if request.Params.V != nil {
		version = *request.Params.V
	}
	image, err := h.gameImages.Image(ctx, request.GameId, string(request.Kind), version)
	switch {
	case errors.Is(err, domain.ErrGameImageNotFound):
		return publicapi.GetGameImage404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameImageNotFound)}, nil
	case err != nil:
		return nil, err
	}
	cacheControl, noSniffValue := gameImageCacheControl, noSniff
	return publicapi.GetGameImage200ImageResponse{
		Body:          bytes.NewReader(image.Data),
		ContentType:   image.MediaType,
		ContentLength: int64(len(image.Data)),
		Headers:       publicapi.GetGameImage200ResponseHeaders{CacheControl: &cacheControl, XContentTypeOptions: &noSniffValue},
	}, nil
}
