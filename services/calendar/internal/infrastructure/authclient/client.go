// Package authclient implements the calendar's UserDirectory port by calling auth's internal API. The generated types
// stay in this package.
package authclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"openlobby/pkg/requestid"
	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
	"openlobby/services/calendar/internal/infrastructure/authclient/gen"
)

const (
	// maxIDsPerCall is the most user IDs one lookup accepts (api/auth/internal.yaml, ADR 0003).
	maxIDsPerCall = 100
	// lookupTimeout bounds the whole lookup, all batches together (ADR 0004, amendment 2026-11-02).
	lookupTimeout = 5 * time.Second
	// maxResponseBytes bounds the answer read from auth, so a faulty peer cannot exhaust memory.
	maxResponseBytes = 64 << 10
)

// Directory implements application.UserDirectory by calling auth's internal lookup.
type Directory struct {
	api *gen.Client
}

var _ application.UserDirectory = (*Directory)(nil)

// New returns a directory for the auth service at baseURL.
func New(baseURL string) (*Directory, error) {
	api, err := gen.NewClient(baseURL)
	if err != nil {
		return nil, fmt.Errorf("create auth client: %w", err)
	}
	return &Directory{api: api}, nil
}

// forwardRequestID passes the correlation ID of the calling request on to auth (ADR 0001).
func forwardRequestID(ctx context.Context, req *http.Request) {
	if id := requestid.FromContext(ctx); id != "" {
		req.Header.Set(requestid.Header, id)
	}
}

// DisplayNames returns the display name of each user ID. Lists longer than maxIDsPerCall are split into batches that
// run in order under one deadline. A user without a name is an error, never an empty name.
func (d *Directory) DisplayNames(ctx context.Context, userIDs []string) (map[string]string, error) {
	ctx, cancel := context.WithTimeout(ctx, lookupTimeout)
	defer cancel()
	names := make(map[string]string, len(userIDs))
	for start := 0; start < len(userIDs); start += maxIDsPerCall {
		batch := userIDs[start:min(start+maxIDsPerCall, len(userIDs))]
		found, err := d.lookup(ctx, batch)
		if err != nil {
			return nil, err
		}
		maps.Copy(names, found)
	}
	return names, nil
}

// lookup asks auth for one batch. A failure to reach auth is unavailable; nothing is written, so no change is lost.
// The request is built here, not by the generated LookupUsers, so that a build failure (a bug) is not mistaken for
// an unreachable auth.
func (d *Directory) lookup(ctx context.Context, userIDs []string) (_ map[string]string, err error) {
	ids, err := parseIDs(userIDs)
	if err != nil {
		return nil, err
	}
	request, err := gen.NewLookupUsersRequest(d.api.Server, nil, gen.LookupUsersJSONRequestBody{UserIds: ids})
	if err != nil {
		return nil, fmt.Errorf("lookup users: build request: %w", err)
	}
	request = request.WithContext(ctx)
	forwardRequestID(ctx, request)
	response, err := d.api.Client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("lookup users: %w: %w", domain.ErrUnavailable, err)
	}
	defer func() { err = errors.Join(err, response.Body.Close()) }()
	return readNames(response, userIDs)
}

// readNames maps auth's answer. Only 503 is unavailable (ADR 0003); every other status is a fault.
func readNames(response *http.Response, requested []string) (map[string]string, error) {
	switch response.StatusCode {
	case http.StatusOK:
		return decodeNames(response.Body, requested)
	case http.StatusServiceUnavailable:
		return nil, fmt.Errorf("lookup users: auth answered 503: %w", domain.ErrUnavailable)
	default:
		return nil, fmt.Errorf("lookup users: auth answered status %d", response.StatusCode)
	}
}

// decodeNames reads the names and checks that every requested user has one. A missing or empty name is a fault.
// shortcut: the answer is checked against the generated types, not against the schema at runtime, upgrade to schema validation if a wrong answer gets through (ADR 0012)
func decodeNames(body io.Reader, requested []string) (map[string]string, error) {
	var list gen.UserNameList
	if err := json.NewDecoder(io.LimitReader(body, maxResponseBytes)).Decode(&list); err != nil {
		return nil, fmt.Errorf("lookup users: decode answer: %w", err)
	}
	names := make(map[string]string, len(list.Users))
	for _, user := range list.Users {
		names[user.UserId.String()] = user.DisplayName
	}
	for _, id := range requested {
		if names[id] == "" {
			return nil, errors.New("lookup users: auth left out a requested name")
		}
	}
	return names, nil
}

// parseIDs converts the IDs into the generated form. An ID that is not a uuid is a bug in the caller.
func parseIDs(userIDs []string) (*[]openapi_types.UUID, error) {
	ids := make([]openapi_types.UUID, 0, len(userIDs))
	for _, value := range userIDs {
		var id openapi_types.UUID
		if err := id.UnmarshalText([]byte(value)); err != nil {
			return nil, fmt.Errorf("lookup users: user ID: %w", err)
		}
		ids = append(ids, id)
	}
	return &ids, nil
}
