package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// groupLockTimeout bounds the wait for a group lock. A longer wait is reported as unavailable (ADR 0006).
const groupLockTimeout = "5s"

const (
	setLockTimeoutSQL = "SET LOCAL lock_timeout = '" + groupLockTimeout + "'"
	// The group lock is the first lock of the transaction (ADR 0006, lock-order invariant).
	lockGroupSQL = `SELECT id FROM groups WHERE id = $1 FOR UPDATE`
)

var _ application.GroupTx = lockedTx{}

// lockedTx is the transaction of WithLockedGroup. Its methods return the database's errors unchanged; WithLockedGroup
// translates them once.
type lockedTx struct{ tx *sql.Tx }

// WithLockedGroup runs fn in one transaction that holds the group's row lock (ADR 0006). The transaction is committed
// when fn succeeds. It returns domain.ErrGroupNotFound when the group does not exist.
func (r groupRepo) WithLockedGroup(ctx context.Context, groupID string, fn func(application.GroupTx) error) error {
	err := r.s.inTx(ctx, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, setLockTimeoutSQL); err != nil {
			return err
		}
		var lockedID string
		err := tx.QueryRowContext(ctx, lockGroupSQL, groupID).Scan(&lockedID)
		if errors.Is(err, sql.ErrNoRows) {
			return domain.ErrGroupNotFound
		}
		if err != nil {
			return err
		}
		return fn(lockedTx{tx})
	})
	return translate(err)
}

// Membership reads the membership under the lock, so a rule that decides a write sees the committed state.
func (t lockedTx) Membership(ctx context.Context, groupID, userID string) (domain.Member, bool, error) {
	return membership(ctx, t.tx, groupID, userID)
}

func (t lockedTx) DeleteInactiveInviteLinks(ctx context.Context, groupID string, now time.Time) error {
	_, err := t.tx.ExecContext(ctx, deleteInactiveInviteLinksSQL, groupID, now)
	return err
}

// InsertInviteLink stores the link and returns it with the ID the database gave it.
func (t lockedTx) InsertInviteLink(ctx context.Context, link domain.InviteLink) (domain.InviteLink, error) {
	err := t.tx.QueryRowContext(ctx, insertInviteLinkSQL,
		link.GroupID, link.Token, link.CreatedByUserID, link.CreatedAt, link.ExpiresAt, int(link.MaxUses),
	).Scan(&link.ID)
	return link, err
}
