// Package systemclock implements application.Clock with the system time in UTC.
package systemclock

import "time"

// Clock reads the system clock.
type Clock struct{}

// Now returns the current time in UTC.
func (Clock) Now() time.Time {
	return time.Now().UTC()
}
