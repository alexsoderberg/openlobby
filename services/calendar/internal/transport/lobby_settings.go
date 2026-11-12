package transport

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"openlobby/pkg/httpapi"
	"openlobby/services/calendar/internal/domain"
	publicapi "openlobby/services/calendar/internal/transport/gen/publicapi"
)

// settingsErrors maps the rule errors of a settings change to the contract's status and code (ADR 0017 section 10).
var settingsErrors = []struct {
	err    error
	status int
	code   publicapi.ErrorBodyCode
}{
	{domain.ErrGroupNotFound, http.StatusNotFound, publicapi.ErrorBodyCodeGroupNotFound},
	{domain.ErrLobbyNotFound, http.StatusNotFound, publicapi.ErrorBodyCodeLobbyNotFound},
	{domain.ErrLobbyHasEnded, http.StatusConflict, publicapi.ErrorBodyCodeLobbyHasEnded},
	{domain.ErrNotAllowed, http.StatusForbidden, publicapi.ErrorBodyCodeNotAllowed},
	{domain.ErrInvalidGame, http.StatusBadRequest, publicapi.ErrorBodyCodeInvalidGame},
	{domain.ErrInvalidMode, http.StatusBadRequest, publicapi.ErrorBodyCodeInvalidMode},
	{domain.ErrInvalidActivity, http.StatusBadRequest, publicapi.ErrorBodyCodeInvalidActivity},
	{domain.ErrLobbyGameSet, http.StatusConflict, publicapi.ErrorBodyCodeLobbyGameSet},
	{domain.ErrLobbyChanged, http.StatusConflict, publicapi.ErrorBodyCodeLobbyChanged},
	{domain.ErrLobbyHasMorePlayers, http.StatusConflict, publicapi.ErrorBodyCodeLobbyHasMorePlayers},
}

// settingsFailure is the error answer of the four settings operations. They share it because every operation answers
// the same statuses with the same body, and the generated types differ only by name.
type settingsFailure struct {
	status int
	body   publicapi.ErrorBody
}

func (f settingsFailure) write(w http.ResponseWriter) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(f.status)
	return json.NewEncoder(w).Encode(publicapi.ErrorResponse{Error: f.body})
}

func (f settingsFailure) VisitSetLobbyGameResponse(w http.ResponseWriter) error { return f.write(w) }
func (f settingsFailure) VisitSetLobbyModeResponse(w http.ResponseWriter) error { return f.write(w) }
func (f settingsFailure) VisitSetLobbyActivityResponse(w http.ResponseWriter) error {
	return f.write(w)
}
func (f settingsFailure) VisitClearLobbyActivityResponse(w http.ResponseWriter) error {
	return f.write(w)
}

// settingsReply turns the result of a settings use case into the lobby, or the contract's error answer. Any other
// error is returned for the 503 and 500 handling.
func settingsReply(ctx context.Context, lobby domain.Lobby, err error) (publicapi.Lobby, *settingsFailure, error) {
	for _, rule := range settingsErrors {
		if errors.Is(err, rule.err) {
			return publicapi.Lobby{}, &settingsFailure{rule.status, publicErrorBody(ctx, rule.code)}, nil
		}
	}
	if err != nil {
		return publicapi.Lobby{}, nil, err
	}
	body, err := lobbyBody(lobby)
	return publicapi.Lobby(body), nil, err
}

// SetLobbyGame sets the game of a lobby with no game for a player of it. requireBodyKeys has refused a body without its key.
func (h publicHandler) SetLobbyGame(ctx context.Context, request publicapi.SetLobbyGameRequestObject) (publicapi.SetLobbyGameResponseObject, error) {
	lobby, err := h.lobbies.SetGame(ctx, request.GroupId, request.LobbyId, userIDFrom(ctx), request.Body.GameId.String())
	answer, failure, err := settingsReply(ctx, lobby, err)
	switch {
	case err != nil:
		return nil, err
	case failure != nil:
		return failure, nil
	}
	return publicapi.SetLobbyGame200JSONResponse(answer), nil
}

// SetLobbyMode changes the mode of a lobby for a player of it. requireBodyKeys has refused a body without its keys.
func (h publicHandler) SetLobbyMode(ctx context.Context, request publicapi.SetLobbyModeRequestObject) (publicapi.SetLobbyModeResponseObject, error) {
	body := request.Body
	var current *string
	if body.CurrentModeId != nil {
		id := body.CurrentModeId.String()
		current = &id
	}
	lobby, err := h.lobbies.SetMode(ctx, request.GroupId, request.LobbyId, userIDFrom(ctx), body.ModeId.String(), current)
	answer, failure, err := settingsReply(ctx, lobby, err)
	switch {
	case err != nil:
		return nil, err
	case failure != nil:
		return failure, nil
	}
	return publicapi.SetLobbyMode200JSONResponse(answer), nil
}

// SetLobbyActivity sets the named activity of a lobby for a player of it. requireBodyKeys has refused a body without its key.
func (h publicHandler) SetLobbyActivity(ctx context.Context, request publicapi.SetLobbyActivityRequestObject) (publicapi.SetLobbyActivityResponseObject, error) {
	lobby, err := h.lobbies.SetActivity(ctx, request.GroupId, request.LobbyId, userIDFrom(ctx), request.Body.ActivityId.String())
	answer, failure, err := settingsReply(ctx, lobby, err)
	switch {
	case err != nil:
		return nil, err
	case failure != nil:
		return failure, nil
	}
	return publicapi.SetLobbyActivity200JSONResponse(answer), nil
}

// ClearLobbyActivity removes the named activity of a lobby for a player of it.
func (h publicHandler) ClearLobbyActivity(ctx context.Context, request publicapi.ClearLobbyActivityRequestObject) (publicapi.ClearLobbyActivityResponseObject, error) {
	lobby, err := h.lobbies.ClearActivity(ctx, request.GroupId, request.LobbyId, userIDFrom(ctx))
	answer, failure, err := settingsReply(ctx, lobby, err)
	switch {
	case err != nil:
		return nil, err
	case failure != nil:
		return failure, nil
	}
	return publicapi.ClearLobbyActivity200JSONResponse(answer), nil
}

// requiredBodyKeys lists, per mux pattern as the generated code registers it, the body keys the contract requires, and
// whether each one may be null.
var requiredBodyKeys = map[string]map[string]bool{
	http.MethodPut + " /api/groups/{groupId}/lobbies/{lobbyId}/game":     {"gameId": false},
	http.MethodPut + " /api/groups/{groupId}/lobbies/{lobbyId}/mode":     {"modeId": false, "currentModeId": true},
	http.MethodPut + " /api/groups/{groupId}/lobbies/{lobbyId}/activity": {"activityId": false},
	// A missing gameRoleIds must never clear the choices; only an empty array does (ADR 0022 point 4).
	http.MethodPut + " /api/users/me/preferred-game-roles": {"gameRoleIds": false},
}

// requireBodyKeys refuses a settings body with a required key missing, or null where the contract does not allow it.
// The generated types read both as the zero UUID or nil, which a valid request can also mean: an all-zero ID is
// invalid_game, invalid_mode or invalid_activity after the membership check, and an explicit null currentModeId means "no mode". A
// body that is not a JSON object is left to the decoder, which reports it as invalid_request.
func requireBodyKeys(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if required, ok := requiredBodyKeys[r.Pattern]; ok {
			data, err := io.ReadAll(r.Body)
			r.Body = io.NopCloser(bytes.NewReader(data))
			var keys map[string]json.RawMessage
			// A read error is a body over the limit (httpapi.LimitBody): the part read may hold the keys, so it is refused.
			if err != nil || (json.Unmarshal(data, &keys) == nil && !hasKeys(keys, required)) {
				httpapi.WriteError(r.Context(), w, http.StatusBadRequest, string(publicapi.ErrorBodyCodeInvalidRequest))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func hasKeys(keys map[string]json.RawMessage, required map[string]bool) bool {
	for key, nullable := range required {
		value, present := keys[key]
		if !present || (!nullable && string(value) == "null") {
			return false
		}
	}
	return true
}
