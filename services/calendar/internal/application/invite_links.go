package application

import (
	"context"
	"errors"
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

// Get returns the group of an active link and whether the caller is already a member. Any other link gives
// domain.ErrInviteInvalid, without the group (ADR 0007). The lookup has no lock: nothing is written.
func (l *InviteLinks) Get(ctx context.Context, token, callerID string) (domain.Group, bool, error) {
	lookup, found, err := l.links.FindLinkByToken(ctx, token)
	if err != nil {
		return domain.Group{}, false, fmt.Errorf("get invite: %w", err)
	}
	if !found || !lookup.Link.IsActive(l.clock.Now()) {
		return domain.Group{}, false, domain.ErrInviteInvalid
	}
	_, isMember, err := l.reader.Membership(ctx, lookup.Group.ID, callerID)
	if err != nil {
		return domain.Group{}, false, fmt.Errorf("get invite: %w", err)
	}
	return lookup.Group, isMember, nil
}

// Join makes the caller a member through an active link and counts one use (ADR 0007). A member who joins again is
// answered the same way, and nothing is written.
func (l *InviteLinks) Join(ctx context.Context, token, callerID string) (domain.Group, error) {
	lookup, found, err := l.links.FindLinkByToken(ctx, token)
	if err != nil {
		return domain.Group{}, fmt.Errorf("join invite: %w", err)
	}
	if !found {
		return domain.Group{}, domain.ErrInviteInvalid
	}
	// The group name is from the unlocked lookup. That is safe only because groups cannot be renamed (no requirement in MVP).
	err = l.locker.WithLockedGroup(ctx, lookup.Group.ID, func(tx GroupTx) error {
		return l.joinLocked(ctx, tx, lookup.Group.ID, lookup.Link.ID, callerID)
	})
	switch {
	case errors.Is(err, domain.ErrGroupNotFound):
		return domain.Group{}, domain.ErrInviteInvalid
	case err != nil:
		return domain.Group{}, fmt.Errorf("join invite: %w", err)
	}
	return lookup.Group, nil
}

// joinLocked runs under the group lock. The link is read again, because the lookup had no lock (ADR 0007, step 3).
// Activity is checked before membership, so an exhausted link refuses a member too.
func (l *InviteLinks) joinLocked(ctx context.Context, tx GroupTx, groupID, linkID, callerID string) error {
	link, found, err := tx.LinkByID(ctx, groupID, linkID)
	if err != nil {
		return err
	}
	now := l.clock.Now()
	if !found || !link.IsActive(now) {
		return domain.ErrInviteInvalid
	}
	_, isMember, err := tx.Membership(ctx, groupID, callerID)
	if err != nil {
		return err
	}
	if isMember {
		return nil
	}
	if err := tx.AddMember(ctx, groupID, callerID, now); err != nil {
		return err
	}
	return tx.IncrementUse(ctx, groupID, linkID)
}
