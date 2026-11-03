package postgres

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"unicode/utf8"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	insertInviteLinkSQL = `INSERT INTO invite_links (group_id, token, created_by_user_id, created_at, expires_at, max_uses)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`
	// Inactive means expired or used up, the same rule as domain.InviteLink.IsActive (ADR 0007).
	deleteInactiveInviteLinksSQL = `DELETE FROM invite_links WHERE group_id = $1 AND (expires_at <= $2 OR use_count >= max_uses)`
	// The token lookup joins the group, so a link whose group is gone is not found (ADR 0007, item 13).
	selectLinkByTokenSQL = `SELECT l.id, l.group_id, l.created_by_user_id, l.expires_at, l.use_count, l.max_uses, g.name
		FROM invite_links l JOIN groups g ON g.id = l.group_id WHERE l.token = $1`
	// Both IDs are in the WHERE clause, so a link of another group is not found (ADR 0006 rule 12).
	selectLinkByIDSQL = `SELECT id, created_by_user_id, expires_at, use_count, max_uses FROM invite_links WHERE id = $1 AND group_id = $2`
	incrementUseSQL   = `UPDATE invite_links SET use_count = use_count + 1 WHERE id = $1 AND group_id = $2`
	// No ORDER BY: the contract does not promise an order for the list.
	selectLinksOfGroupSQL   = `SELECT id, token, created_by_user_id, expires_at, use_count, max_uses FROM invite_links WHERE group_id = $1`
	selectLinksCreatedBySQL = selectLinksOfGroupSQL + ` AND created_by_user_id = $2`
)

// inviteLinkRepo implements the reads of invite links. The writes run under the group lock in lockedTx.
type inviteLinkRepo struct{ s *Store }

var _ application.InviteLinkReader = inviteLinkRepo{}

// InviteLinks returns the invite link repository.
func (s *Store) InviteLinks() inviteLinkRepo { return inviteLinkRepo{s} }

// FindLinkByToken returns the link with its group. A token that matches no link gives false and no error. The token is
// a bind value and is never put into an error (ADR 0007).
func (r inviteLinkRepo) FindLinkByToken(ctx context.Context, token string) (application.LinkLookup, bool, error) {
	// A NUL byte or invalid UTF-8 cannot be stored in text, so such a token matches no link. Without this check
	// PostgreSQL refuses the value and the request would answer 500 instead of invite_invalid (ADR 0007).
	if !utf8.ValidString(token) || strings.ContainsRune(token, 0) {
		return application.LinkLookup{}, false, nil
	}
	var lookup application.LinkLookup
	var maxUses int
	err := r.s.db.QueryRowContext(ctx, selectLinkByTokenSQL, token).Scan(
		&lookup.Link.ID, &lookup.Link.GroupID, &lookup.Link.CreatedByUserID, &lookup.Link.ExpiresAt,
		&lookup.Link.UseCount, &maxUses, &lookup.Group.Name)
	switch {
	case errors.Is(err, sql.ErrNoRows):
		return application.LinkLookup{}, false, nil
	case err != nil:
		return application.LinkLookup{}, false, translate(err)
	}
	lookup.Link.MaxUses = domain.InviteLinkMaxUses(maxUses)
	lookup.Group.ID = lookup.Link.GroupID
	return lookup, true, nil
}

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
