package transport

import (
	"context"
	"errors"

	"openlobby/pkg/httpapi"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// noStoreHeader is the Cache-Control of every response that carries an invite token (ADR 0007).
const noStoreHeader = "no-store"

// CreateInviteLink makes a new link for a member. A malformed group ID is the same 404 as an unknown group (ADR 0001).
// The body is optional: a missing or null maxUses gives the default (ADR 0007).
func (h publicHandler) CreateInviteLink(ctx context.Context, request publicapi.CreateInviteLinkRequestObject) (publicapi.CreateInviteLinkResponseObject, error) {
	if !httpapi.IsUUID(request.GroupId) {
		return publicapi.CreateInviteLink404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	}
	link, err := h.invites.Create(ctx, request.GroupId, userIDFrom(ctx), requestedMaxUses(request.Body))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.CreateInviteLink404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case errors.Is(err, domain.ErrInvalidMaxUses):
		return publicapi.CreateInviteLink400JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInvalidMaxUses)}, nil
	case err != nil:
		return nil, err
	}
	body, err := inviteLinkBody(link)
	if err != nil {
		return nil, err
	}
	return publicapi.CreateInviteLink201JSONResponse{Body: body, Headers: publicapi.CreateInviteLink201ResponseHeaders{CacheControl: noStore()}}, nil
}

// ListInviteLinks returns the active links the caller may see. A member gets their own links, an admin all of them.
func (h publicHandler) ListInviteLinks(ctx context.Context, request publicapi.ListInviteLinksRequestObject) (publicapi.ListInviteLinksResponseObject, error) {
	if !httpapi.IsUUID(request.GroupId) {
		return publicapi.ListInviteLinks404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	}
	links, err := h.invites.List(ctx, request.GroupId, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.ListInviteLinks404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case err != nil:
		return nil, err
	}
	body, err := inviteLinkList(links)
	if err != nil {
		return nil, err
	}
	return publicapi.ListInviteLinks200JSONResponse{Body: body, Headers: publicapi.ListInviteLinks200ResponseHeaders{CacheControl: noStore()}}, nil
}

// requestedMaxUses returns the max uses the body asks for, or nil when it is omitted or null. The domain decides the rule.
func requestedMaxUses(body *publicapi.CreateInviteLinkRequest) *int {
	if body == nil {
		return nil
	}
	return body.MaxUses
}

// inviteLinkBody converts a link into the contract shape. Times are sent in UTC (ADR 0001).
func inviteLinkBody(link domain.InviteLink) (publicapi.InviteLink, error) {
	id, err := parseUUID(link.ID)
	if err != nil {
		return publicapi.InviteLink{}, err
	}
	creatorID, err := parseUUID(link.CreatedByUserID)
	if err != nil {
		return publicapi.InviteLink{}, err
	}
	return publicapi.InviteLink{
		Id:              id,
		Token:           link.Token,
		CreatedByUserId: creatorID,
		ExpiresAt:       link.ExpiresAt.UTC(),
		UseCount:        link.UseCount,
		MaxUses:         int(link.MaxUses),
	}, nil
}

// inviteLinkList converts the links. An empty list is [] and never null.
func inviteLinkList(links []domain.InviteLink) ([]publicapi.InviteLink, error) {
	list := make([]publicapi.InviteLink, 0, len(links))
	for _, link := range links {
		body, err := inviteLinkBody(link)
		if err != nil {
			return nil, err
		}
		list = append(list, body)
	}
	return list, nil
}

// noStore returns the Cache-Control value for a response with a token. The generated headers take a pointer.
func noStore() *string {
	value := noStoreHeader
	return &value
}
