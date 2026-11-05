package application

import (
	"context"
	"fmt"
	"slices"

	"openlobby/services/calendar/internal/domain"
)

// Memberships holds the use cases about a user's membership of a group.
type Memberships struct {
	locker MembershipLocker
	clock  Clock
}

// NewMemberships returns the membership use cases with their ports.
func NewMemberships(locker MembershipLocker, clock Clock) *Memberships {
	return &Memberships{locker: locker, clock: clock}
}

// Leave removes the caller from the group in one transaction under the group lock (ADR 0004 rule 5, REQ-0006). A
// non-member gets domain.ErrGroupNotFound and a creator of upcoming lobbies domain.ErrOwnUpcomingLobbiesExist; both
// change nothing.
func (m *Memberships) Leave(ctx context.Context, groupID, callerID string) error {
	err := m.locker.WithLockedGroup(ctx, groupID, func(tx LeaveTx) error {
		return m.leaveLocked(ctx, tx, groupID, callerID)
	})
	if err != nil {
		return fmt.Errorf("leave group: %w", err)
	}
	return nil
}

func (m *Memberships) leaveLocked(ctx context.Context, tx LeaveTx, groupID, callerID string) error {
	member, err := requireMember(ctx, tx, groupID, callerID)
	if err != nil {
		return err
	}
	now := m.clock.Now()
	hasLobbies, err := tx.HasUpcomingLobbyBy(ctx, groupID, callerID, now)
	if err != nil {
		return err
	}
	if hasLobbies {
		return domain.ErrOwnUpcomingLobbiesExist
	}
	members, err := tx.Members(ctx, groupID)
	if err != nil {
		return err
	}
	others := slices.DeleteFunc(members, func(other domain.Member) bool { return other.UserID == callerID })
	if len(others) == 0 {
		return tx.DeleteGroup(ctx, groupID)
	}
	if err := tx.RemoveLeaverData(ctx, groupID, callerID, now); err != nil {
		return err
	}
	if member.Role != domain.RoleAdmin || slices.ContainsFunc(others, isAdmin) {
		return nil
	}
	// The members come in join order, so the first one has been in the group the longest.
	return tx.MakeAdmin(ctx, groupID, others[0].UserID)
}

// MakeAdmin makes the target a group admin in one transaction under the group lock (REQ-0008). A caller who is not a
// member gets domain.ErrGroupNotFound, a member who is not an admin domain.ErrNotAllowed and a target who is not a
// member domain.ErrMemberNotFound; all change nothing. A target who is already admin is no error.
func (m *Memberships) MakeAdmin(ctx context.Context, groupID, callerID, targetID string) error {
	err := m.locker.WithLockedGroup(ctx, groupID, func(tx LeaveTx) error {
		caller, err := requireMember(ctx, tx, groupID, callerID)
		if err != nil {
			return err
		}
		if !isAdmin(caller) {
			return domain.ErrNotAllowed
		}
		target, isMember, err := tx.Membership(ctx, groupID, targetID)
		if err != nil {
			return err
		}
		if !isMember {
			return domain.ErrMemberNotFound
		}
		if isAdmin(target) {
			return nil
		}
		return tx.MakeAdmin(ctx, groupID, targetID)
	})
	if err != nil {
		return fmt.Errorf("make group admin: %w", err)
	}
	return nil
}

func isAdmin(member domain.Member) bool { return member.Role == domain.RoleAdmin }
