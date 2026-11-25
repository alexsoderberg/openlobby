package transport

import (
	"bytes"
	"context"
	"errors"

	"openlobby/pkg/httpapi"
	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// itemIconCacheControl keeps an icon in the browser for an hour only: the URL has no version, and the server's cache
// decides how long Blizzard's data is kept (ADR 0029 section 5).
const itemIconCacheControl = "private, max-age=3600"

// ListGameItems returns the drop-list items of a game to any signed-in person (ADR 0029 section 5).
func (h publicHandler) ListGameItems(ctx context.Context, request publicapi.ListGameItemsRequestObject) (publicapi.ListGameItemsResponseObject, error) {
	// The query is bound as plain strings, so identity and the gameId form are checked first (ADR 0001 order).
	activityID, query := "", ""
	if request.Params.ActivityId != nil {
		activityID = *request.Params.ActivityId
		if !httpapi.IsUUID(activityID) {
			return publicapi.ListGameItems400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidRequest)}, nil
		}
	}
	if request.Params.Q != nil {
		query = *request.Params.Q
	}
	items, complete, err := h.items.ListGameItems(ctx, request.GameId, activityID, query)
	switch {
	case errors.Is(err, domain.ErrInvalidItemSearch):
		return publicapi.ListGameItems400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidRequest)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.ListGameItems404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case errors.Is(err, domain.ErrInvalidActivity):
		return publicapi.ListGameItems400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidActivity)}, nil
	case err != nil:
		return nil, err
	}
	list := publicapi.ListGameItems200JSONResponse{Items: make([]publicapi.GameItem, 0, len(items)), NameSearchComplete: complete}
	for _, item := range items {
		gameItem, err := gameItemBody(item)
		if err != nil {
			return nil, err
		}
		list.Items = append(list.Items, gameItem)
	}
	return list, nil
}

// AddDropItem puts an item on a drop list (system admin). A malformed activity ID is a shape error (ADR 0001 step 2).
func (h publicHandler) AddDropItem(ctx context.Context, request publicapi.AddDropItemRequestObject) (publicapi.AddDropItemResponseObject, error) {
	if !httpapi.IsUUID(request.ActivityId) {
		return publicapi.AddDropItem400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidActivity)}, nil
	}
	item, err := h.items.AddDropItem(ctx, actorFrom(ctx), request.GameId, request.ActivityId, request.ItemId)
	switch {
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.AddDropItem403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case errors.Is(err, domain.ErrInvalidItem):
		return publicapi.AddDropItem400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidItem)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.AddDropItem404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case errors.Is(err, domain.ErrInvalidActivity):
		return publicapi.AddDropItem400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidActivity)}, nil
	case errors.Is(err, application.ErrDropItemTaken):
		return publicapi.AddDropItem409JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeDropItemTaken)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.AddDropItem201JSONResponse(itemBody(item)), nil
}

// RemoveDropItem takes an item off a drop list (system admin); an item that is not on it is also 204.
func (h publicHandler) RemoveDropItem(ctx context.Context, request publicapi.RemoveDropItemRequestObject) (publicapi.RemoveDropItemResponseObject, error) {
	if !httpapi.IsUUID(request.ActivityId) {
		return publicapi.RemoveDropItem400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidActivity)}, nil
	}
	err := h.items.RemoveDropItem(ctx, actorFrom(ctx), request.GameId, request.ActivityId, request.ItemId)
	switch {
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.RemoveDropItem403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case errors.Is(err, domain.ErrInvalidItem):
		return publicapi.RemoveDropItem400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidItem)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.RemoveDropItem404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case errors.Is(err, domain.ErrInvalidActivity):
		return publicapi.RemoveDropItem400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidActivity)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.RemoveDropItem204Response{}, nil
}

// GetItemIcon sends the icon of an item on a drop list or in a goal. An unavailable catalog is 503 through the error
// handler (ADR 0029 section 5).
func (h publicHandler) GetItemIcon(ctx context.Context, request publicapi.GetItemIconRequestObject) (publicapi.GetItemIconResponseObject, error) {
	icon, err := h.items.ItemIcon(ctx, request.ItemId)
	switch {
	case errors.Is(err, domain.ErrInvalidItem):
		return publicapi.GetItemIcon400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidItem)}, nil
	case errors.Is(err, application.ErrItemNotFound):
		return publicapi.GetItemIcon404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeItemNotFound)}, nil
	case err != nil:
		return nil, err
	}
	cacheControl, noSniffValue := itemIconCacheControl, noSniff
	return publicapi.GetItemIcon200ImageResponse{
		Body:          bytes.NewReader(icon.Bytes),
		ContentType:   icon.MediaType,
		ContentLength: int64(len(icon.Bytes)),
		Headers:       publicapi.GetItemIcon200ResponseHeaders{CacheControl: &cacheControl, XContentTypeOptions: &noSniffValue},
	}, nil
}

// itemBody gives the name only when it is known; otherwise it is null.
func itemBody(item domain.Item) publicapi.Item {
	body := publicapi.Item{ItemId: int(item.ID), Status: publicapi.ItemStatus(item.Status)}
	if item.Status == domain.ItemKnown {
		body.Name = &item.Name
	}
	return body
}

func gameItemBody(item domain.GameItem) (publicapi.GameItem, error) {
	base := itemBody(item.Item)
	body := publicapi.GameItem{ItemId: base.ItemId, Name: base.Name, Status: base.Status, DropsIn: make([]publicapi.DropActivity, 0, len(item.DropsIn))}
	for _, activity := range item.DropsIn {
		id, err := parseUUID(activity.ActivityID)
		if err != nil {
			return publicapi.GameItem{}, err
		}
		body.DropsIn = append(body.DropsIn, publicapi.DropActivity{ActivityId: id, ActivityName: activity.ActivityName, ModeName: activity.ModeName})
	}
	return body, nil
}
