// Package domain holds the entities and rules of the calendar service. It imports nothing outside the standard library.
package domain

import (
	"errors"
	"strings"
	"unicode/utf8"
)

// ErrUnavailable means that a dependency (the database or auth) did not answer. The request was refused (ADR 0001).
var ErrUnavailable = errors.New("dependency unavailable")

// ErrGroupNotFound means the group does not exist or the caller is not a member. Both give the same answer (ADR 0004 rule 2).
var ErrGroupNotFound = errors.New("group not found")

// ErrInvalidGroupName means the name is empty after trim or longer than maxGroupNameLength (REQ-0002).
var ErrInvalidGroupName = errors.New("invalid group name")

// maxGroupNameLength is counted in Unicode code points, the same as the database check (ADR 0004 rule 1).
const maxGroupNameLength = 50

// Role is a member's role in a group (ADR 0004 rule 4).
type Role string

// The two roles of a membership.
const (
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
)

// Group is a group of the calendar (ADR 0006). The caller sees it only as a member.
type Group struct {
	ID   string
	Name string
}

// Member is a user's membership in a group. DisplayName is not stored; the application fills it from auth.
type Member struct {
	UserID      string
	DisplayName string
	Role        Role
}

// NewGroupName trims the name and checks its length. It returns the trimmed name.
func NewGroupName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	if name == "" || utf8.RuneCountInString(name) > maxGroupNameLength {
		return "", ErrInvalidGroupName
	}
	return name, nil
}
