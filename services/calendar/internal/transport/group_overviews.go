package transport

import (
	"context"

	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// ListGroupOverviews returns the Group overviews of the caller's groups (ADR 0025). 503 when the database or auth does
// not answer (ADR 0001).
func (h publicHandler) ListGroupOverviews(ctx context.Context, _ publicapi.ListGroupOverviewsRequestObject) (publicapi.ListGroupOverviewsResponseObject, error) {
	overviews, err := h.groups.ListOverviews(ctx, userIDFrom(ctx))
	if err != nil {
		return nil, err
	}
	list := make(publicapi.ListGroupOverviews200JSONResponse, 0, len(overviews))
	for _, overview := range overviews {
		body, err := groupOverviewBody(overview)
		if err != nil {
			return nil, err
		}
		list = append(list, body)
	}
	return list, nil
}

// groupOverviewBody converts one Group overview into the contract shape. Members is never null.
func groupOverviewBody(overview domain.GroupOverview) (publicapi.GroupOverview, error) {
	id, err := parseUUID(overview.Group.ID)
	if err != nil {
		return publicapi.GroupOverview{}, err
	}
	members := make([]publicapi.UserRef, 0, len(overview.Members))
	for _, member := range overview.Members {
		userID, err := parseUUID(member.UserID)
		if err != nil {
			return publicapi.GroupOverview{}, err
		}
		members = append(members, publicapi.UserRef{UserId: userID, DisplayName: member.DisplayName})
	}
	body := publicapi.GroupOverview{Id: id, Name: overview.Group.Name, MemberCount: overview.MemberCount, Members: members}
	if lobby := overview.NextLobby; lobby != nil {
		body.NextLobby = &publicapi.NextLobby{
			GameName: lobby.GameName, ModeName: lobby.ModeName, ActivityName: lobby.ActivityName,
			GameGenre: convertEnum[publicapi.Genre](lobby.GameGenre), MaxPlayers: lobby.MaxPlayers,
			StartsAt: lobby.StartsAt.UTC(), EndsAt: lobby.EndsAt.UTC(), PlayerCount: lobby.PlayerCount,
		}
	}
	return body, nil
}
