package postgres

import (
	"context"
	"errors"
	"time"

	"openlobby/services/auth/internal/application"
	"openlobby/services/auth/internal/domain"
)

// userRepo implements application.UserRepository on the store.
type userRepo struct{ store *Store }

// sessionRepo implements application.SessionRepository on the store.
type sessionRepo struct{ store *Store }

// attemptRepo implements application.LoginAttemptRepository on the store.
type attemptRepo struct{ store *Store }

// Upsert creates the user of the identity or updates its display name (ADR 0005, step 6).
// The database generates the uuid; RETURNING gives it back.
func (r userRepo) Upsert(ctx context.Context, identity application.ExternalIdentity) (domain.User, error) {
	var user domain.User
	err := r.store.conn(ctx).QueryRowContext(ctx, `
		INSERT INTO users (provider, provider_subject_id, display_name)
		VALUES ($1, $2, $3)
		ON CONFLICT (provider, provider_subject_id)
		DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = CURRENT_TIMESTAMP
		RETURNING id::text, provider, provider_subject_id, display_name`,
		identity.Provider, identity.SubjectID, identity.DisplayName,
	).Scan(&user.ID, &user.Provider, &user.ProviderSubjectID, &user.DisplayName)
	return user, translate(err)
}

// FindByID returns the user with the given ID.
func (r userRepo) FindByID(ctx context.Context, userID string) (domain.User, error) {
	var user domain.User
	err := r.store.conn(ctx).QueryRowContext(ctx, `
		SELECT id::text, provider, provider_subject_id, display_name FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Provider, &user.ProviderSubjectID, &user.DisplayName)
	return user, translate(err)
}

// FindByIDs returns the users among userIDs in one query. Unknown IDs are left out.
func (r userRepo) FindByIDs(ctx context.Context, userIDs []string) (users []domain.User, err error) {
	rows, err := r.store.conn(ctx).QueryContext(ctx, `
		SELECT id::text, provider, provider_subject_id, display_name
		FROM users WHERE id = ANY($1::uuid[])`,
		userIDs,
	)
	if err != nil {
		return nil, translate(err)
	}
	defer func() { err = errors.Join(err, rows.Close()) }()
	for rows.Next() {
		var user domain.User
		if err := rows.Scan(&user.ID, &user.Provider, &user.ProviderSubjectID, &user.DisplayName); err != nil {
			return nil, translate(err)
		}
		users = append(users, user)
	}
	return users, translate(rows.Err())
}

// Insert stores a session by the hash of its token.
func (r sessionRepo) Insert(ctx context.Context, tokenHash []byte, userID string, expiresAt time.Time) error {
	_, err := r.store.conn(ctx).ExecContext(ctx, `
		INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
		tokenHash, userID, expiresAt,
	)
	return translate(err)
}

// Find returns the session of a token hash, including an expired one. The caller checks the expiry.
func (r sessionRepo) Find(ctx context.Context, tokenHash []byte) (domain.Session, error) {
	var session domain.Session
	err := r.store.conn(ctx).QueryRowContext(ctx, `
		SELECT user_id::text, expires_at FROM sessions WHERE token_hash = $1`,
		tokenHash,
	).Scan(&session.UserID, &session.ExpiresAt)
	return session, translate(err)
}

// Delete removes a session. Deleting a missing session is not an error.
func (r sessionRepo) Delete(ctx context.Context, tokenHash []byte) error {
	_, err := r.store.conn(ctx).ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = $1`, tokenHash)
	return translate(err)
}

// DeleteExpired removes sessions that have expired. There is no background job (ADR 0005).
func (r sessionRepo) DeleteExpired(ctx context.Context, now time.Time) error {
	_, err := r.store.conn(ctx).ExecContext(ctx, `DELETE FROM sessions WHERE expires_at <= $1`, now)
	return translate(err)
}

// Insert stores a login attempt by the hash of its state.
func (r attemptRepo) Insert(ctx context.Context, stateHash []byte, codeVerifier, returnTo string, expiresAt time.Time) error {
	_, err := r.store.conn(ctx).ExecContext(ctx, `
		INSERT INTO login_attempts (state_hash, code_verifier, return_to, expires_at)
		VALUES ($1, $2, $3, $4)`,
		stateHash, codeVerifier, returnTo, expiresAt,
	)
	return translate(err)
}

// Consume deletes the attempt and returns it in one statement, so it works only once (ADR 0005, step 4).
func (r attemptRepo) Consume(ctx context.Context, stateHash []byte, now time.Time) (application.LoginAttempt, error) {
	var attempt application.LoginAttempt
	err := r.store.conn(ctx).QueryRowContext(ctx, `
		DELETE FROM login_attempts WHERE state_hash = $1 AND expires_at > $2
		RETURNING code_verifier, return_to`,
		stateHash, now,
	).Scan(&attempt.CodeVerifier, &attempt.ReturnTo)
	return attempt, translate(err)
}

// DeleteExpired removes expired login attempts when a new one is created (ADR 0005).
func (r attemptRepo) DeleteExpired(ctx context.Context, now time.Time) error {
	_, err := r.store.conn(ctx).ExecContext(ctx, `DELETE FROM login_attempts WHERE expires_at <= $1`, now)
	return translate(err)
}
