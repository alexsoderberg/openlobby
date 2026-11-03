package postgres

import (
	"context"
	"errors"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	insertInviteLinkSQL = `INSERT INTO invite_links (group_id, token, created_by_user_id, created_at, expires_at, max_uses)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
	// Inactive means expired or used up, the same rule as domain.InviteLink.IsActive (ADR 0007).
	deleteInactiveInviteLinksSQL = `DELETE FROM invite_links WHERE group_id = $1 AND (expires_at <= $2 OR use_count >= max_uses)`
	// No ORDER BY: the contract does not promise an order for the list.
	selectLinksOfGroupSQL   = `SELECT id, token, created_by_user_id, expires_at, use_count, max_uses FROM invite_links WHERE group_id = $1`
	selectLinksCreatedBySQL = selectLinksOfGroupSQL + ` AND created_by_user_id = $2`
)

// inviteLinkRepo implements the reads of invite links. The writes run under the group lock in lockedTx.
type inviteLinkRepo struct{ s *Store }

var _ application.InviteLinkReader = inviteLinkRepo{}

// InviteLinks returns the invite link repository.
func (s *Store) InviteLinks() inviteLinkRepo { return inviteLinkRepo{s} }

// AllLinks returns every link of the group, active or not.
func (r inviteLinkRepo) AllLinks(ctx context.Context, groupID string) ([]domain.InviteLink, error) {
	return r.queryLinks(ctx, selectLinksOfGroupSQL, groupID)
}

// LinksCreatedBy returns the links of the group that the user created, active or not.
func (r inviteLinkRepo) LinksCreatedBy(ctx context.Context, groupID, userID string) ([]domain.InviteLink, error) {
	return r.queryLinks(ctx, selectLinksCreatedBySQL, groupID, userID)
}

// queryLinks reads links. The close error of the rows is joined into the result.
func (r inviteLinkRepo) queryLinks(ctx context.Context, query string, args ...any) (links []domain.InviteLink, err error) {
	rows, err := r.s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, translate(err)
	}
	defer func() { err = errors.Join(err, translate(rows.Close())) }()
	for rows.Next() {
		var link domain.InviteLink
		var maxUses int
		if scanErr := rows.Scan(&link.ID, &link.Token, &link.CreatedByUserID, &link.ExpiresAt, &link.UseCount, &maxUses); scanErr != nil {
			return nil, translate(scanErr)
		}
		link.MaxUses = domain.InviteLinkMaxUses(maxUses)
		links = append(links, link)
	}
	return links, translate(rows.Err())
}
