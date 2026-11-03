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

// GetInvite shows the group of an active link and whether the caller is a member. Every other link is the same 404
// (ADR 0007). The token is a secret, so the answer is never cached.
func (h publicHandler) GetInvite(ctx context.Context, request publicapi.GetInviteRequestObject) (publicapi.GetInviteResponseObject, error) {
	group, isMember, err := h.invites.Get(ctx, request.Token, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrInviteInvalid):
		return publicapi.GetInvite404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInviteInvalid)}, nil
	case err != nil:
		return nil, err
	}
	id, err := parseUUID(group.ID)
	if err != nil {
		return nil, err
	}
	body := publicapi.InviteInfo{GroupId: id, GroupName: group.Name, IsMember: isMember}
	return publicapi.GetInvite200JSONResponse{Body: body, Headers: publicapi.GetInvite200ResponseHeaders{CacheControl: noStore()}}, nil
}

// JoinInvite makes the caller a member through an active link. A member who joins again gets the same 200.
func (h publicHandler) JoinInvite(ctx context.Context, request publicapi.JoinInviteRequestObject) (publicapi.JoinInviteResponseObject, error) {
	group, err := h.invites.Join(ctx, request.Token, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrInviteInvalid):
		return publicapi.JoinInvite404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInviteInvalid)}, nil
	case err != nil:
		return nil, err
	}
	id, err := parseUUID(group.ID)
	if err != nil {
		return nil, err
	}
	return publicapi.JoinInvite200JSONResponse{Id: id, Name: group.Name}, nil
}

// RevokeInviteLink deletes a link for its creator or a group admin. A malformed group ID is group_not_found and a
// malformed link ID is invite_invalid, both before the membership check (ADR 0001, ADR 0007).
func (h publicHandler) RevokeInviteLink(ctx context.Context, request publicapi.RevokeInviteLinkRequestObject) (publicapi.RevokeInviteLinkResponseObject, error) {
	if !httpapi.IsUUID(request.GroupId) {
		return publicapi.RevokeInviteLink404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	}
	if !httpapi.IsUUID(request.LinkId) {
		return publicapi.RevokeInviteLink404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInviteInvalid)}, nil
	}
	err := h.invites.Revoke(ctx, request.GroupId, request.LinkId, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.RevokeInviteLink404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case errors.Is(err, domain.ErrInviteInvalid):
		return publicapi.RevokeInviteLink404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeInviteInvalid)}, nil
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.RevokeInviteLink403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.RevokeInviteLink204Response{}, nil
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
