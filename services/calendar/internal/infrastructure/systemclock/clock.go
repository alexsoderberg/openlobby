// Package systemclock is the calendar's Clock adapter: the host's time, in UTC (ADR 0001).
package systemclock

import "time"

// Clock reads the host's current time.
type Clock struct{}

// Now returns the current time in UTC.
func (Clock) Now() time.Time { return time.Now().UTC() }
