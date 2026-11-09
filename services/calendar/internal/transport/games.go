package transport

import (
	"context"
	"errors"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// gameBadRequests and gameConflicts map the errors of a game list write to the contract's 400 and 409 codes (ADR 0001,
// ADR 0017 section 6). A repeated or foreign ID is a malformed request.
var (
	gameBadRequests = []gameErrorCode{
		{domain.ErrInvalidGame, publicapi.ErrorBodyCodeInvalidGame},
		{domain.ErrInvalidCapacity, publicapi.ErrorBodyCodeInvalidCapacity},
		{domain.ErrInvalidGenre, publicapi.ErrorBodyCodeInvalidGenre},
		{domain.ErrInvalidGameRole, publicapi.ErrorBodyCodeInvalidGameRole},
		{domain.ErrInvalidMode, publicapi.ErrorBodyCodeInvalidMode},
		{domain.ErrInvalidActivity, publicapi.ErrorBodyCodeInvalidActivity},
		{domain.ErrInvalidID, publicapi.ErrorBodyCodeInvalidRequest},
	}
	gameConflicts = []gameErrorCode{
		{application.ErrGameTaken, publicapi.ErrorBodyCodeGameTaken},
		{application.ErrModeTaken, publicapi.ErrorBodyCodeModeTaken},
		{application.ErrGameRoleTaken, publicapi.ErrorBodyCodeGameRoleTaken},
		{application.ErrActivityTaken, publicapi.ErrorBodyCodeActivityTaken},
	}
)

type gameErrorCode struct {
	err  error
	code publicapi.ErrorBodyCode
}

// codeOf returns the code of the entry that matches err.
func codeOf(table []gameErrorCode, err error) (publicapi.ErrorBodyCode, bool) {
	for _, entry := range table {
		if errors.Is(err, entry.err) {
			return entry.code, true
		}
	}
	return "", false
}

// ListGroupGames returns the game list in the group's order to a member. A malformed group ID and a non-member get the
// same 404 as an unknown group (ADR 0001, ADR 0004 rule 2). "Other" is not in the list; the client adds it.
func (h publicHandler) ListGroupGames(ctx context.Context, request publicapi.ListGroupGamesRequestObject) (publicapi.ListGroupGamesResponseObject, error) {
	games, err := h.games.ListGroupGames(ctx, request.GroupId, userIDFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return publicapi.ListGroupGames404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGroupNotFound)}, nil
	case err != nil:
		return nil, err
	}
	list, err := gameList(games)
	if err != nil {
		return nil, err
	}
	return publicapi.ListGroupGames200JSONResponse(list), nil
}

// ListGames returns the whole game list to a system admin. Anyone else gets 403 (REQ-0010, ADR 0011).
func (h publicHandler) ListGames(ctx context.Context, _ publicapi.ListGamesRequestObject) (publicapi.ListGamesResponseObject, error) {
	games, err := h.games.ListGames(ctx, actorFrom(ctx))
	switch {
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.ListGames403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case err != nil:
		return nil, err
	}
	list, err := gameList(games)
	if err != nil {
		return nil, err
	}
	return publicapi.ListGames200JSONResponse(list), nil
}

// CreateGame adds a game and returns it with its generated ID. The checks run in the order of ADR 0001: permission,
// then the name, the default max, the genre, the game roles and modes, then the duplicate names.
func (h publicHandler) CreateGame(ctx context.Context, request publicapi.CreateGameRequestObject) (publicapi.CreateGameResponseObject, error) {
	body := request.Body
	game, err := h.games.CreateGame(ctx, actorFrom(ctx), valueOrEmpty(body.Name), body.DefaultMaxPlayers, convertGenre[domain.Genre](body.Genre), gameRoleInputs(body.GameRoles), modeInputs(body.Modes))
	if code, found := codeOf(gameBadRequests, err); found {
		return publicapi.CreateGame400JSONResponse{Error: publicErrorBody(ctx, code)}, nil
	}
	if code, found := codeOf(gameConflicts, err); found {
		return publicapi.CreateGame409JSONResponse{Error: publicErrorBody(ctx, code)}, nil
	}
	switch {
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.CreateGame403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case err != nil:
		return nil, err
	}
	result, err := gameBody(game)
	if err != nil {
		return nil, err
	}
	return publicapi.CreateGame201JSONResponse(result), nil
}

// ReplaceGame changes a game's name, default max, genre, game roles and modes and keeps its ID. A malformed ID is 404
// before the permission check (ADR 0001 step 1), so a non-admin learns nothing from it.
func (h publicHandler) ReplaceGame(ctx context.Context, request publicapi.ReplaceGameRequestObject) (publicapi.ReplaceGameResponseObject, error) {
	body := request.Body
	game, err := h.games.ReplaceGame(ctx, actorFrom(ctx), request.GameId, valueOrEmpty(body.Name), body.DefaultMaxPlayers, convertGenre[domain.Genre](body.Genre), gameRoleInputs(body.GameRoles), modeInputs(body.Modes))
	if code, found := codeOf(gameBadRequests, err); found {
		return publicapi.ReplaceGame400JSONResponse{Error: publicErrorBody(ctx, code)}, nil
	}
	if code, found := codeOf(gameConflicts, err); found {
		return publicapi.ReplaceGame409JSONResponse{Error: publicErrorBody(ctx, code)}, nil
	}
	switch {
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.ReplaceGame403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.ReplaceGame404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case err != nil:
		return nil, err
	}
	result, err := gameBody(game)
	if err != nil {
		return nil, err
	}
	return publicapi.ReplaceGame200JSONResponse(result), nil
}

// DeleteGame removes a game from the list. A malformed ID is 404 before the permission check (ADR 0001 step 1).
func (h publicHandler) DeleteGame(ctx context.Context, request publicapi.DeleteGameRequestObject) (publicapi.DeleteGameResponseObject, error) {
	err := h.games.DeleteGame(ctx, actorFrom(ctx), request.GameId)
	switch {
	case errors.Is(err, domain.ErrNotAllowed):
		return publicapi.DeleteGame403JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeNotAllowed)}, nil
	case errors.Is(err, application.ErrGameNotFound):
		return publicapi.DeleteGame404JSONResponse{Error: publicErrorBody(ctx, publicapi.ErrorBodyCodeGameNotFound)}, nil
	case err != nil:
		return nil, err
	}
	return publicapi.DeleteGame204Response{}, nil
}

// valueOrEmpty returns the string, or "" when it is omitted or null. The domain then refuses the empty name (ADR 0001).
func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

// gameList converts the games into the contract shape. An empty input gives an empty list, never null.
func gameList(games []domain.Game) ([]publicapi.Game, error) {
	list := make([]publicapi.Game, 0, len(games))
	for _, game := range games {
		body, err := gameBody(game)
		if err != nil {
			return nil, err
		}
		list = append(list, body)
	}
	return list, nil
}

// gameBody converts one game into the contract shape. A nil default max is sent as null. The game roles and modes are
// always sent, as empty lists when there are none (ADR 0017 section 12).
func gameBody(game domain.Game) (publicapi.Game, error) {
	id, err := parseUUID(game.ID)
	if err != nil {
		return publicapi.Game{}, err
	}
	roles, err := gameRoleBodies(game.GameRoles)
	if err != nil {
		return publicapi.Game{}, err
	}
	modes := make([]publicapi.GameMode, 0, len(game.Modes))
	for _, mode := range game.Modes {
		body, err := modeBody(mode)
		if err != nil {
			return publicapi.Game{}, err
		}
		modes = append(modes, body)
	}
	return publicapi.Game{Id: id, Name: game.Name, DefaultMaxPlayers: game.DefaultMaxPlayers, Genre: convertGenre[publicapi.Genre](game.Genre), GameRoles: &roles, Modes: &modes}, nil
}

func modeBody(mode domain.GameMode) (publicapi.GameMode, error) {
	id, err := parseUUID(mode.ID)
	if err != nil {
		return publicapi.GameMode{}, err
	}
	roles, err := gameRoleBodies(mode.GameRoles)
	if err != nil {
		return publicapi.GameMode{}, err
	}
	activities := make([]publicapi.Activity, 0, len(mode.Activities))
	for _, activity := range mode.Activities {
		activityID, err := parseUUID(activity.ID)
		if err != nil {
			return publicapi.GameMode{}, err
		}
		activities = append(activities, publicapi.Activity{Id: activityID, Name: activity.Name})
	}
	// MaxPlayers is never nil in a stored or validated mode (domain.newMode, the adapter reads it from a NOT NULL column).
	return publicapi.GameMode{Id: id, Name: mode.Name, MaxPlayers: *mode.MaxPlayers, GameRoles: roles, Activities: activities}, nil
}

func gameRoleBodies(roles []domain.GameRole) ([]publicapi.GameRole, error) {
	bodies := make([]publicapi.GameRole, 0, len(roles))
	for _, role := range roles {
		id, err := parseUUID(role.ID)
		if err != nil {
			return nil, err
		}
		bodies = append(bodies, publicapi.GameRole{Id: id, Name: role.Name, Slots: role.Slots})
	}
	return bodies, nil
}

// optionalID returns the ID as text, or "" when it is omitted (a new entry).
func optionalID(id *openapi_types.UUID) string {
	if id == nil {
		return ""
	}
	return id.String()
}

// gameRoleInputs converts the roles of a request. An omitted or null list stays nil, which means "unchanged" for the
// game and "none" inside a mode (ADR 0017 section 6).
func gameRoleInputs(list *[]publicapi.GameRoleInput) []domain.GameRole {
	if list == nil {
		return nil
	}
	roles := make([]domain.GameRole, 0, len(*list))
	for _, role := range *list {
		roles = append(roles, domain.GameRole{ID: optionalID(role.Id), Name: role.Name, Slots: role.Slots})
	}
	return roles
}

func modeInputs(list *[]publicapi.GameModeInput) []domain.GameMode {
	if list == nil {
		return nil
	}
	modes := make([]domain.GameMode, 0, len(*list))
	for _, mode := range *list {
		modes = append(modes, domain.GameMode{ID: optionalID(mode.Id), Name: mode.Name, MaxPlayers: mode.MaxPlayers, GameRoles: gameRoleInputs(mode.GameRoles), Activities: activityInputs(mode.Activities)})
	}
	return modes
}

func activityInputs(list *[]publicapi.ActivityInput) []domain.Activity {
	if list == nil {
		return nil
	}
	activities := make([]domain.Activity, 0, len(*list))
	for _, activity := range *list {
		activities = append(activities, domain.Activity{ID: optionalID(activity.Id), Name: activity.Name})
	}
	return activities
}

// convertGenre moves a genre between the contract type and the domain type. Both are strings; the domain checks the value.
func convertGenre[To, From ~string](genre *From) *To {
	if genre == nil {
		return nil
	}
	converted := To(*genre)
	return &converted
}
