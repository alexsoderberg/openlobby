package postgres

import (
	"context"
	"errors"

	"openlobby/services/calendar/internal/domain"
)

// No ORDER BY: the contract promises no order for GET /api/groups (api/calendar/openapi.yaml).
const listGroupsForUserSQL = `SELECT g.id, g.name FROM groups g JOIN group_members m ON m.group_id = g.id WHERE m.user_id = $1`

// groupRepo implements application.GroupRepository.
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
