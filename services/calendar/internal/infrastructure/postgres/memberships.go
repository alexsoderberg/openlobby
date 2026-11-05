package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	hasUpcomingLobbyBySQL   = `SELECT EXISTS (SELECT 1 FROM lobbies WHERE group_id = $1 AND created_by_user_id = $2 AND ends_at > $3)`
	deleteUpcomingPlayerSQL = `DELETE FROM lobby_players WHERE user_id = $2
		AND lobby_id IN (SELECT id FROM lobbies WHERE group_id = $1 AND ends_at > $3)`
	deleteLinksBySQL = `DELETE FROM invite_links WHERE group_id = $1 AND created_by_user_id = $2`
	deleteMemberSQL  = `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`
	makeAdminSQL     = `UPDATE group_members SET role = $3 WHERE group_id = $1 AND user_id = $2`
	deleteGroupSQL   = `DELETE FROM groups WHERE id = $1`
)

var (
	_ application.MembershipLocker = membershipRepo{}
	_ application.LeaveTx          = leaveTx{}
)

// membershipRepo implements the membership port of the application layer.
type membershipRepo struct{ s *Store }

// Memberships returns the membership repository.
func (s *Store) Memberships() membershipRepo { return membershipRepo{s} }

// WithLockedGroup runs fn in one transaction that holds the group's row lock.
func (r membershipRepo) WithLockedGroup(ctx context.Context, groupID string, fn func(application.LeaveTx) error) error {
	return r.s.withGroupLock(ctx, groupID, func(tx *sql.Tx) error { return fn(leaveTx{tx}) })
}

// leaveTx is the transaction of membershipRepo.WithLockedGroup. Its methods return the database's errors unchanged;
// withGroupLock translates them once.
type leaveTx struct{ tx *sql.Tx }

func (t leaveTx) Membership(ctx context.Context, groupID, userID string) (domain.Member, bool, error) {
	return membership(ctx, t.tx, groupID, userID)
}

func (t leaveTx) Members(ctx context.Context, groupID string) (members []domain.Member, err error) {
	rows, err := t.tx.QueryContext(ctx, selectMembersSQL, groupID)
	if err != nil {
		return nil, err
	}
	defer func() { err = errors.Join(err, rows.Close()) }()
	for rows.Next() {
		var member domain.Member
		var role string
		if err := rows.Scan(&member.UserID, &role); err != nil {
			return nil, err
		}
		member.Role = domain.Role(role)
		members = append(members, member)
	}
	return members, rows.Err()
}

func (t leaveTx) HasUpcomingLobbyBy(ctx context.Context, groupID, userID string, now time.Time) (exists bool, err error) {
	err = t.tx.QueryRowContext(ctx, hasUpcomingLobbyBySQL, groupID, userID, now).Scan(&exists)
	return exists, err
}

func (t leaveTx) RemoveLeaverData(ctx context.Context, groupID, userID string, now time.Time) error {
	if _, err := t.tx.ExecContext(ctx, deleteUpcomingPlayerSQL, groupID, userID, now); err != nil {
		return err
	}
	if _, err := t.tx.ExecContext(ctx, deleteLinksBySQL, groupID, userID); err != nil {
		return err
	}
	_, err := t.tx.ExecContext(ctx, deleteMemberSQL, groupID, userID)
	return err
}

func (t leaveTx) MakeAdmin(ctx context.Context, groupID, userID string) error {
	_, err := t.tx.ExecContext(ctx, makeAdminSQL, groupID, userID, domain.RoleAdmin)
	return err
}

// DeleteGroup removes the group. Members, lobbies, players and links go with it (ON DELETE CASCADE).
func (t leaveTx) DeleteGroup(ctx context.Context, groupID string) error {
	_, err := t.tx.ExecContext(ctx, deleteGroupSQL, groupID)
	return err
}
