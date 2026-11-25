// Package blizzardcache keeps the answers of an item catalog in memory, in front of the Blizzard adapter (ADR 0029
// section 4). Entries are never written anywhere else, and none lives longer than catalogFoundTTL (ADR 0029 C2).
package blizzardcache

import (
	"context"
	"errors"
	"maps"
	"sync"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const (
	// catalogFoundTTL is well under Blizzard's 30-day limit (ADR 0029 section 1).
	catalogFoundTTL = 7 * 24 * time.Hour
	// catalogUnknownTTL keeps a page of unknown items from calling Blizzard on each view.
	catalogUnknownTTL = 24 * time.Hour
	// catalogMaxEntries with icons of at most domain.MaxItemIconBytes bounds the cache to about 8.5 MiB (ADR 0008).
	catalogMaxEntries = 512
	// catalogSweepInterval bounds how long an expired entry stays in memory without traffic: at most the TTL plus this
	// (ADR 0029 Amendment 2026-11-25 item 9).
	catalogSweepInterval = time.Hour
)

// key is one answer: the name or the icon of an item.
type key struct {
	itemID domain.ItemID
	icon   bool
}

type entry struct {
	value   any
	err     error
	expires time.Time
}

// Cache decorates an item catalog. Found answers are kept 7 days, not found 1 day, and unavailable is not kept.
// shortcut: in memory, empty after a restart (DECISION user, 2026-11-25); upgrade to a table only if that is a problem.
// RunSweeps must run, so that expired entries leave memory also without traffic.
type Cache struct {
	next    application.ItemCatalog
	clock   application.Clock
	mu      sync.Mutex
	entries map[key]entry
}

var _ application.ItemCatalog = (*Cache)(nil)

// New returns the cache in front of next.
func New(next application.ItemCatalog, clock application.Clock) *Cache {
	return &Cache{next: next, clock: clock, entries: map[key]entry{}}
}

// Item returns the kept name answer, or asks the catalog.
func (c *Cache) Item(ctx context.Context, itemID domain.ItemID) (domain.CatalogItem, error) {
	return cached(c, key{itemID: itemID}, func() (domain.CatalogItem, error) { return c.next.Item(ctx, itemID) })
}

// ItemIcon returns the kept icon answer, or asks the catalog.
func (c *Cache) ItemIcon(ctx context.Context, itemID domain.ItemID) (domain.ItemIcon, error) {
	return cached(c, key{itemID: itemID, icon: true}, func() (domain.ItemIcon, error) { return c.next.ItemIcon(ctx, itemID) })
}

// cached does not hold the lock during the call, so a slow answer never blocks the cached ones. Two requests for the
// same item may both call; the rate limit of the adapter bounds that. Each miss removes every expired entry first.
func cached[T any](c *Cache, k key, fetch func() (T, error)) (T, error) {
	now := c.clock.Now()
	c.mu.Lock()
	kept, found := c.entries[k]
	fresh := found && now.Before(kept.expires)
	if !fresh {
		c.removeExpired(now)
	}
	c.mu.Unlock()
	if fresh {
		value, _ := kept.value.(T)
		return value, kept.err
	}
	value, err := fetch()
	ttl := catalogFoundTTL
	switch {
	case errors.Is(err, application.ErrItemNotFound):
		ttl = catalogUnknownTTL
	case err != nil:
		return value, err
	}
	c.keep(k, entry{value: value, err: err, expires: c.clock.Now().Add(ttl)})
	return value, err
}

// keep stores the entry, unless the cache is full; the answer is still given.
func (c *Cache) keep(k key, e entry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, replaces := c.entries[k]; replaces || len(c.entries) < catalogMaxEntries {
		c.entries[k] = e
	}
}

// RunSweeps removes the expired entries every catalogSweepInterval until the context ends.
func (c *Cache) RunSweeps(ctx context.Context) {
	ticker := time.NewTicker(catalogSweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.Sweep()
		}
	}
}

// Sweep removes every entry whose expiry has passed, by the injected clock.
func (c *Cache) Sweep() {
	now := c.clock.Now()
	c.mu.Lock()
	defer c.mu.Unlock()
	c.removeExpired(now)
}

// removeExpired needs the lock held.
func (c *Cache) removeExpired(now time.Time) {
	maps.DeleteFunc(c.entries, func(_ key, e entry) bool { return !now.Before(e.expires) })
}
