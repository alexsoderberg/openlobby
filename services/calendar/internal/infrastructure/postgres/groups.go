package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"openlobby/services/calendar/internal/domain"
)

// No ORDER BY: the contract promises no order for GET /api/groups (api/calendar/openapi.yaml).
const listGroupsForUserSQL = `SELECT g.id, g.name FROM groups g JOIN group_members m ON m.group_id = g.id WHERE m.user_id = $1`

const (
	insertGroupSQL      = `INSERT INTO groups (name) VALUES ($1) RETURNING id`
	insertMemberSQL     = `INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES ($1, $2, $3, $4)`
	selectGroupSQL      = `SELECT id, name FROM groups WHERE id = $1`
	selectMembershipSQL = `SELECT user_id, role FROM group_members WHERE group_id = $1 AND user_id = $2`
	// The tie-break on user_id keeps the order stable when two members joined at the same time.
	selectMembersSQL = `SELECT user_id, role FROM group_members WHERE group_id = $1 ORDER BY joined_at, user_id`
)

// groupRepo implements the group ports of the application layer.
type groupRepo struct{ s *Store }

// ListForUser returns the groups where userID is a member. The close error of the rows is joined into the result.
func (r groupRepo) ListForUser(ctx context.Context, userID string) (groups []domain.Group, err error) {
	rows, err := r.s.db.QueryContext(ctx, listGroupsForUserSQL, userID)
	if err != nil {
		return nil, translate(err)
	}
	defer func() { err = errors.Join(err, translate(rows.Close())) }()
	for rows.Next() {
		var group domain.Group
		if scanErr := rows.Scan(&group.ID, &group.Name); scanErr != nil {
			return nil, translate(scanErr)
		}
		groups = append(groups, group)
	}
	return groups, translate(rows.Err())
}

// Create stores the group and the creator's admin membership in one transaction (ADR 0004).
func (r groupRepo) Create(ctx context.Context, name, creatorID string, joinedAt time.Time) (domain.Group, error) {
	group := domain.Group{Name: name}
	err := r.s.inTx(ctx, func(tx *sql.Tx) error {
		if err := tx.QueryRowContext(ctx, insertGroupSQL, name).Scan(&group.ID); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, insertMemberSQL, group.ID, creatorID, domain.RoleAdmin, joinedAt)
		return err
	})
	if err != nil {
		return domain.Group{}, translate(err)
	}
	return group, nil
}

// Group returns the group, or domain.ErrGroupNotFound when it does not exist.
func (r groupRepo) Group(ctx context.Context, groupID string) (domain.Group, error) {
	var group domain.Group
	err := r.s.db.QueryRowContext(ctx, selectGroupSQL, groupID).Scan(&group.ID, &group.Name)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return domain.Group{}, domain.ErrGroupNotFound
	case err != nil:
		return domain.Group{}, translate(err)
	}
	return group, nil
}

// Membership returns the user's membership of the group. Not being a member is no error.
func (r groupRepo) Membership(ctx context.Context, groupID, userID string) (domain.Member, bool, error) {
	member, found, err := membership(ctx, r.s.db, groupID, userID)
	return member, found, translate(err)
}

// rowQuerier is implemented by the connection pool and by a transaction, so one query serves both.
type rowQuerier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// membership reads the user's membership. The error is not translated; the caller does that.
func membership(ctx context.Context, querier rowQuerier, groupID, userID string) (domain.Member, bool, error) {
	var member domain.Member
	var role string
	err := querier.QueryRowContext(ctx, selectMembershipSQL, groupID, userID).Scan(&member.UserID, &role)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return domain.Member{}, false, nil
	case err != nil:
		return domain.Member{}, false, err
	}
	member.Role = domain.Role(role)
	return member, true, nil
}

// Members returns the members of the group with their roles. Names are not stored here (ADR 0003).
func (r groupRepo) Members(ctx context.Context, groupID string) (members []domain.Member, err error) {
	rows, err := r.s.db.QueryContext(ctx, selectMembersSQL, groupID)
	if err != nil {
		return nil, translate(err)
	}
	defer func() { err = errors.Join(err, translate(rows.Close())) }()
	for rows.Next() {
		var member domain.Member
		var role string
		if scanErr := rows.Scan(&member.UserID, &role); scanErr != nil {
			return nil, translate(scanErr)
		}
		member.Role = domain.Role(role)
		members = append(members, member)
	}
	return members, translate(rows.Err())
}
