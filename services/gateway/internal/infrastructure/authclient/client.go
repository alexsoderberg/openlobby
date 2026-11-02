// Package authclient implements the session port by calling auth's internal API. The generated types stay here.
package authclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"openlobby/pkg/requestid"
	"openlobby/services/gateway/internal/application"
	"openlobby/services/gateway/internal/infrastructure/authclient/gen"
)

// maxResponseBytes bounds the answer that is read from auth, so a faulty peer cannot exhaust memory.
const maxResponseBytes = 64 << 10

// Client validates sessions against auth. It implements application.SessionValidator.
type Client struct {
	api *gen.Client
}

var _ application.SessionValidator = (*Client)(nil)

// New returns a client for the auth service at baseURL. Every call is bounded by timeout (ADR 0002 review 5).
func New(baseURL string, timeout time.Duration) (*Client, error) {
	api, err := gen.NewClient(baseURL, gen.WithHTTPClient(&http.Client{Timeout: timeout}))
	if err != nil {
		return nil, fmt.Errorf("create auth client: %w", err)
	}
	return &Client{api: api}, nil
}

// Validate returns the user of a session. A transport failure or timeout is ErrUnavailable: nothing was changed.
func (c *Client) Validate(ctx context.Context, sessionToken string) (session application.Session, err error) {
	requestID := requestid.FromContext(ctx)
	params := &gen.ValidateSessionParams{XRequestId: &requestID}
	response, err := c.api.ValidateSession(ctx, params, gen.ValidateSessionJSONRequestBody{Token: &sessionToken})
	if err != nil {
		return application.Session{}, fmt.Errorf("validate session: %w: %w", application.ErrUnavailable, err)
	}
	defer func() { err = errors.Join(err, response.Body.Close()) }()
	return readValidation(response)
}

// readValidation maps auth's answer to the port. Only 401 and 503 are given their own meaning (ADR 0002).
func readValidation(response *http.Response) (application.Session, error) {
	switch response.StatusCode {
	case http.StatusOK:
		return decodeSession(response.Body)
	case http.StatusUnauthorized:
		return application.Session{}, application.ErrUnauthenticated
	case http.StatusServiceUnavailable:
		return application.Session{}, fmt.Errorf("validate session: %w", application.ErrUnavailable)
	default:
		return application.Session{}, fmt.Errorf("validate session: auth answered status %d", response.StatusCode)
	}
}

func decodeSession(body io.Reader) (application.Session, error) {
	var validation gen.SessionValidation
	if err := json.NewDecoder(io.LimitReader(body, maxResponseBytes)).Decode(&validation); err != nil {
		return application.Session{}, fmt.Errorf("decode session: %w", err)
	}
	return application.Session{UserID: validation.UserId.String(), IsSystemAdmin: validation.IsSystemAdmin}, nil
}
