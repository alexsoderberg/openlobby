// Package domain holds the entities and rules of the auth service. It imports nothing outside the standard library.
package domain

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode"
)

// ErrNotFound means that the requested row does not exist.
var ErrNotFound = errors.New("not found")

// ErrUnavailable means that a dependency (the database) did not answer. The request was refused (ADR 0001).
var ErrUnavailable = errors.New("dependency unavailable")

// SessionLifetime is the time from login to expiry. There is no sliding renewal (ADR 0005).
const SessionLifetime = 30 * 24 * time.Hour

// LoginAttemptLifetime is the time a login attempt stays usable (ADR 0005).
const LoginAttemptLifetime = 10 * time.Minute

// defaultReturnTo is used when the requested return path is not safe (ADR 0005).
const defaultReturnTo = "/"

// User is a member account. Provider and ProviderSubjectID identify it, never the display name (ADR 0006).
type User struct {
	ID                string
	Provider          string
	ProviderSubjectID string
	DisplayName       string
}

// Session is a logged-in browser session. Its token is never stored, only its hash (ADR 0005).
type Session struct {
	UserID    string
	ExpiresAt time.Time
}

// SessionExpiry returns the expiry of a session created at createdAt.
func SessionExpiry(createdAt time.Time) time.Time {
	return createdAt.Add(SessionLifetime)
}

// ActiveAt reports whether the session is still valid at now.
func (s Session) ActiveAt(now time.Time) bool {
	return now.Before(s.ExpiresAt)
}

// SafeReturnTo returns raw when it is a same-site relative path, and "/" otherwise (ADR 0005, amendment review 4).
// The rule protects against open redirects: browsers read "\" as "/" and drop tabs and newlines inside a URL.
func SafeReturnTo(raw string) string {
	if !strings.HasPrefix(raw, "/") {
		return defaultReturnTo
	}
	if len(raw) > 1 && (raw[1] == '/' || raw[1] == '\\') {
		return defaultReturnTo
	}
	for _, r := range raw {
		if r < 0x20 || r == 0x7f || unicode.IsSpace(r) {
			return defaultReturnTo
		}
	}
	return raw
}

// SystemAdmin identifies a user in the configuration by provider and subject (ADR 0011).
type SystemAdmin struct {
	Provider  string
	SubjectID string
}

// SystemAdmins is the list of system admins from configuration (ADR 0011).
type SystemAdmins []SystemAdmin

// ParseSystemAdmins parses a comma-separated list of provider:subject pairs. An empty value means no system admins.
// Error messages name no value, so that no personal data reaches the log.
func ParseSystemAdmins(raw string, knownProviders []string) (SystemAdmins, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}
	var admins SystemAdmins
	for index, entry := range strings.Split(raw, ",") {
		provider, subject, found := strings.Cut(strings.TrimSpace(entry), ":")
		if !found || subject == "" || !contains(knownProviders, provider) {
			return nil, fmt.Errorf("SYSTEM_ADMINS entry %d is invalid", index+1)
		}
		admins = append(admins, SystemAdmin{Provider: provider, SubjectID: subject})
	}
	return admins, nil
}

// Includes reports whether the user is a system admin.
func (a SystemAdmins) Includes(user User) bool {
	for _, admin := range a {
		if admin.Provider == user.Provider && admin.SubjectID == user.ProviderSubjectID {
			return true
		}
	}
	return false
}

func contains(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}
