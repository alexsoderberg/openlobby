// Package domain holds the entities and rules of the calendar service. It imports nothing outside the standard library.
package domain

import "errors"

// ErrUnavailable means that a dependency (the database) did not answer. The request was refused (ADR 0001).
var ErrUnavailable = errors.New("dependency unavailable")

// Group is a group of the calendar (ADR 0006). The caller sees it only as a member.
type Group struct {
	ID   string
	Name string
}
