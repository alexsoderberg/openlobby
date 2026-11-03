// Package systemclock is the calendar's Clock adapter: the host's time, in UTC (ADR 0001).
package systemclock

import "time"

// Clock reads the host's current time.
type Clock struct{}

// Now returns the current time in UTC, truncated to microseconds, the precision PostgreSQL stores (ADR 0006), so a
// value read back from the database equals the one the API returned.
func (Clock) Now() time.Time { return time.Now().UTC().Truncate(time.Microsecond) }
