package systemclock

import (
	"testing"
	"time"
)

// Now is in UTC and has no finer precision than PostgreSQL stores (ADR 0006).
func TestNowIsUTCAndMicrosecondPrecise(t *testing.T) {
	now := Clock{}.Now()

	if now.Location() != time.UTC {
		t.Fatalf("location %v, want UTC", now.Location())
	}
	if now.Nanosecond()%int(time.Microsecond) != 0 {
		t.Fatalf("nanoseconds %d are finer than a microsecond", now.Nanosecond())
	}
}
