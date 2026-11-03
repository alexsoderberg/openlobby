package application

import (
	"context"
	"fmt"
	"slices"

	"openlobby/services/calendar/internal/domain"
)

// InviteLinks holds the use cases about invite links (ADR 0007). Each one is given the verified caller by the transport.
type InviteLinks struct {
	locker GroupLocker
	reader GroupReader
	links  InviteLinkReader
	tokens TokenGenerator
	clock  Clock
}

// NewInviteLinks returns the invite link use cases with their ports.
func NewInviteLinks(locker GroupLocker, reader GroupReader, links InviteLinkReader, tokens TokenGenerator, clock Clock) *InviteLinks {
	return &InviteLinks{locker: locker, reader: reader, links: links, tokens: tokens, clock: clock}
}

// Create makes a new link for a member. Inactive links of the group are removed in the same locked transaction (ADR 0007).
func (l *InviteLinks) Create(ctx context.Context, groupID, callerID string, requested *int) (domain.InviteLink, error) {
	var link domain.InviteLink
	err := l.locker.WithLockedGroup(ctx, groupID, func(tx GroupTx) error {
		var err error
		link, err = l.createLocked(ctx, tx, groupID, callerID, requested)
		return err
	})
	if err != nil {
		return domain.InviteLink{}, fmt.Errorf("create invite link: %w", err)
	}
	return link, nil
}

// createLocked runs under the group lock. Membership is checked before the max uses, as the contract orders them.
func (l *InviteLinks) createLocked(ctx context.Context, tx GroupTx, groupID, callerID string, requested *int) (domain.InviteLink, error) {
	_, isMember, err := tx.Membership(ctx, groupID, callerID)
	if err != nil {
		return domain.InviteLink{}, err
	}
	if !isMember {
		return domain.InviteLink{}, domain.ErrGroupNotFound
	}
	maxUses, err := domain.NewInviteLinkMaxUses(requested)
	if err != nil {
		return domain.InviteLink{}, err
	}
	token, err := l.tokens.NewToken()
	if err != nil {
		return domain.InviteLink{}, fmt.Errorf("new token: %w", err)
	}
	now := l.clock.Now()
	if err := tx.DeleteInactiveInviteLinks(ctx, groupID, now); err != nil {
		return domain.InviteLink{}, fmt.Errorf("delete inactive links: %w", err)
	}
	return tx.InsertInviteLink(ctx, domain.InviteLink{
		GroupID:         groupID,
		Token:           token,
		CreatedByUserID: callerID,
		CreatedAt:       now,
		ExpiresAt:       now.Add(domain.InviteLinkLifetime),
		MaxUses:         maxUses,
	})
}

// List returns the active links the caller may see: a member's own links, and every link for an admin (ADR 0007).
// A non-member gets domain.ErrGroupNotFound.
func (l *InviteLinks) List(ctx context.Context, groupID, callerID string) ([]domain.InviteLink, error) {
	member, isMember, err := l.reader.Membership(ctx, groupID, callerID)
	if err != nil {
		return nil, fmt.Errorf("list invite links: %w", err)
	}
	if !isMember {
		return nil, domain.ErrGroupNotFound
	}
	var links []domain.InviteLink
	if member.Role == domain.RoleAdmin {
		links, err = l.links.AllLinks(ctx, groupID)
	} else {
		links, err = l.links.LinksCreatedBy(ctx, groupID, callerID)
	}
	if err != nil {
		return nil, fmt.Errorf("list invite links: %w", err)
	}
	now := l.clock.Now()
	return slices.DeleteFunc(links, func(link domain.InviteLink) bool { return !link.IsActive(now) }), nil
}
