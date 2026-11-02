// Package applicationtest provides in-memory implementations of the application ports for tests.
package applicationtest

import (
	"context"
	"fmt"
	"time"

	"openlobby/services/auth/internal/application"
	"openlobby/services/auth/internal/domain"
)

// Memory is an in-memory store with a controllable clock. Setting Down makes every call fail as if the database
// did not answer.
type Memory struct {
	Now  time.Time
	Down bool
	// Failure is returned by every call when set. It stands for an unexpected error (a bug), not an outage.
	Failure  error
	Identity *Identity

	users    map[string]domain.User
	subjects map[string]string
	sessions map[string]domain.Session
	attempts map[string]attempt
	counter  int
}

type attempt struct {
	application.LoginAttempt
	expiresAt time.Time
}

// New returns an empty store whose clock shows now.
func New(now time.Time) *Memory {
	return &Memory{
		Now:      now,
		Identity: &Identity{},
		users:    map[string]domain.User{},
		subjects: map[string]string{},
		sessions: map[string]domain.Session{},
		attempts: map[string]attempt{},
	}
}

// Ports wires the store into application ports with the given system admins.
func (m *Memory) Ports(admins domain.SystemAdmins) application.Ports {
	return application.Ports{
		Identity: m.Identity,
		Users:    usersView{m},
		Sessions: sessionsView{m},
		Attempts: attemptsView{m},
		Tx:       txView{m},
		Clock:    clockView{m},
		Tokens:   tokensView{m},
		Admins:   admins,
	}
}

// SessionCount returns the number of stored sessions.
func (m *Memory) SessionCount() int { return len(m.sessions) }

// AttemptCount returns the number of stored login attempts.
func (m *Memory) AttemptCount() int { return len(m.attempts) }

// UserCount returns the number of stored users.
func (m *Memory) UserCount() int { return len(m.users) }

func (m *Memory) unavailable() error {
	if m.Down {
		return domain.ErrUnavailable
	}
	return m.Failure
}

// Identity is a fake login provider. Exchange returns Result, or Err when it is set.
type Identity struct {
	Result       application.ExternalIdentity
	Err          error
	LastVerifier string
}

// AuthorizationURL builds a URL that shows the state and the challenge, so tests can check them.
func (i *Identity) AuthorizationURL(state, codeChallenge string) string {
	return "https://provider.test/authorize?state=" + state + "&code_challenge=" + codeChallenge
}

// Exchange records the verifier it received and returns the configured identity.
func (i *Identity) Exchange(_ context.Context, _, codeVerifier string) (application.ExternalIdentity, error) {
	i.LastVerifier = codeVerifier
	if i.Err != nil {
		return application.ExternalIdentity{}, i.Err
	}
	return i.Result, nil
}

type clockView struct{ m *Memory }

func (c clockView) Now() time.Time { return c.m.Now }

type tokensView struct{ m *Memory }

func (t tokensView) NewToken() (string, error) {
	t.m.counter++
	return fmt.Sprintf("token-%d", t.m.counter), nil
}

type txView struct{ m *Memory }

func (t txView) InTx(ctx context.Context, fn func(context.Context) error) error {
	if err := t.m.unavailable(); err != nil {
		return err
	}
	return fn(ctx)
}

type usersView struct{ m *Memory }

func (u usersView) Upsert(_ context.Context, identity application.ExternalIdentity) (domain.User, error) {
	if err := u.m.unavailable(); err != nil {
		return domain.User{}, err
	}
	key := identity.Provider + "/" + identity.SubjectID
	user, exists := u.m.users[u.m.subjects[key]]
	if !exists {
		u.m.counter++
		user = domain.User{
			ID:                fmt.Sprintf("00000000-0000-4000-8000-%012d", u.m.counter),
			Provider:          identity.Provider,
			ProviderSubjectID: identity.SubjectID,
		}
		u.m.subjects[key] = user.ID
	}
	user.DisplayName = identity.DisplayName
	u.m.users[user.ID] = user
	return user, nil
}

func (u usersView) FindByID(_ context.Context, userID string) (domain.User, error) {
	if err := u.m.unavailable(); err != nil {
		return domain.User{}, err
	}
	user, exists := u.m.users[userID]
	if !exists {
		return domain.User{}, domain.ErrNotFound
	}
	return user, nil
}

func (u usersView) FindByIDs(_ context.Context, userIDs []string) ([]domain.User, error) {
	if err := u.m.unavailable(); err != nil {
		return nil, err
	}
	var users []domain.User
	seen := map[string]bool{}
	for _, id := range userIDs {
		user, exists := u.m.users[id]
		if exists && !seen[id] {
			seen[id] = true
			users = append(users, user)
		}
	}
	return users, nil
}

type sessionsView struct{ m *Memory }

func (s sessionsView) Insert(_ context.Context, tokenHash []byte, userID string, expiresAt time.Time) error {
	if err := s.m.unavailable(); err != nil {
		return err
	}
	s.m.sessions[string(tokenHash)] = domain.Session{UserID: userID, ExpiresAt: expiresAt}
	return nil
}

func (s sessionsView) Find(_ context.Context, tokenHash []byte) (domain.Session, error) {
	if err := s.m.unavailable(); err != nil {
		return domain.Session{}, err
	}
	session, exists := s.m.sessions[string(tokenHash)]
	if !exists {
		return domain.Session{}, domain.ErrNotFound
	}
	return session, nil
}

func (s sessionsView) Delete(_ context.Context, tokenHash []byte) error {
	if err := s.m.unavailable(); err != nil {
		return err
	}
	delete(s.m.sessions, string(tokenHash))
	return nil
}

func (s sessionsView) DeleteExpired(_ context.Context, now time.Time) error {
	if err := s.m.unavailable(); err != nil {
		return err
	}
	for key, session := range s.m.sessions {
		if !session.ExpiresAt.After(now) {
			delete(s.m.sessions, key)
		}
	}
	return nil
}

type attemptsView struct{ m *Memory }

func (a attemptsView) Insert(_ context.Context, stateHash []byte, codeVerifier, returnTo string, expiresAt time.Time) error {
	if err := a.m.unavailable(); err != nil {
		return err
	}
	a.m.attempts[string(stateHash)] = attempt{
		LoginAttempt: application.LoginAttempt{CodeVerifier: codeVerifier, ReturnTo: returnTo},
		expiresAt:    expiresAt,
	}
	return nil
}

func (a attemptsView) Consume(_ context.Context, stateHash []byte, now time.Time) (application.LoginAttempt, error) {
	if err := a.m.unavailable(); err != nil {
		return application.LoginAttempt{}, err
	}
	found, exists := a.m.attempts[string(stateHash)]
	if !exists || !found.expiresAt.After(now) {
		return application.LoginAttempt{}, domain.ErrNotFound
	}
	delete(a.m.attempts, string(stateHash))
	return found.LoginAttempt, nil
}

func (a attemptsView) DeleteExpired(_ context.Context, now time.Time) error {
	if err := a.m.unavailable(); err != nil {
		return err
	}
	for key, found := range a.m.attempts {
		if !found.expiresAt.After(now) {
			delete(a.m.attempts, key)
		}
	}
	return nil
}
