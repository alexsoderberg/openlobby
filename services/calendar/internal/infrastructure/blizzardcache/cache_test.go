package blizzardcache

import (
	"context"
	"errors"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

// countingCatalog knows item 1, does not know item 2, and is unavailable for item 3. It counts the calls per item.
type countingCatalog struct{ calls map[domain.ItemID]int }

func (c *countingCatalog) answer(itemID domain.ItemID) error {
	c.calls[itemID]++
	switch itemID {
	case 2:
		return application.ErrItemNotFound
	case 3:
		return application.ErrCatalogUnavailable
	}
	return nil
}

func (c *countingCatalog) Item(_ context.Context, itemID domain.ItemID) (domain.CatalogItem, error) {
	if err := c.answer(itemID); err != nil {
		return domain.CatalogItem{}, err
	}
	return domain.CatalogItem{Name: "Thunderfury"}, nil
}

func (c *countingCatalog) ItemIcon(_ context.Context, itemID domain.ItemID) (domain.ItemIcon, error) {
	if err := c.answer(itemID); err != nil {
		return domain.ItemIcon{}, err
	}
	return domain.ItemIcon{MediaType: "image/png", Bytes: []byte{1}}, nil
}

type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time { return c.now }

func newTestCache() (*Cache, *countingCatalog, *fakeClock) {
	next := &countingCatalog{calls: map[domain.ItemID]int{}}
	clock := &fakeClock{now: time.Date(2026, 11, 25, 12, 0, 0, 0, time.UTC)}
	return New(next, clock), next, clock
}

// Found is kept 7 days, not found 1 day, and unavailable is not kept (ADR 0029 section 4).
func TestTheCacheKeepsEachAnswerForItsTTL(t *testing.T) {
	tests := []struct {
		name    string
		itemID  domain.ItemID
		ttl     time.Duration
		wantErr error
	}{
		{name: "found", itemID: 1, ttl: catalogFoundTTL},
		{name: "not found", itemID: 2, ttl: catalogUnknownTTL, wantErr: application.ErrItemNotFound},
		{name: "unavailable", itemID: 3, wantErr: application.ErrCatalogUnavailable},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cache, next, clock := newTestCache()
			ask := func() {
				t.Helper()
				item, err := cache.Item(context.Background(), tc.itemID)
				if !errors.Is(err, tc.wantErr) || (err == nil && item.Name != "Thunderfury") {
					t.Fatalf("item %+v, error %v; want %v", item, err, tc.wantErr)
				}
			}
			ask()
			clock.now = clock.now.Add(tc.ttl - time.Second)
			ask()
			wantCalls := 1
			if tc.ttl == 0 {
				wantCalls = 2
			}
			if next.calls[tc.itemID] != wantCalls {
				t.Fatalf("%d calls before the TTL; want %d", next.calls[tc.itemID], wantCalls)
			}
			clock.now = clock.now.Add(time.Second)
			ask()
			if next.calls[tc.itemID] != wantCalls+1 {
				t.Fatalf("%d calls after the TTL; want %d", next.calls[tc.itemID], wantCalls+1)
			}
		})
	}
}

// The name and the icon of an item are separate answers.
func TestTheCacheKeepsTheIconApartFromTheName(t *testing.T) {
	cache, next, _ := newTestCache()

	if _, err := cache.Item(context.Background(), 1); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		icon, err := cache.ItemIcon(context.Background(), 1)
		if err != nil || icon.MediaType != "image/png" {
			t.Fatalf("icon %+v, error %v", icon, err)
		}
	}
	if next.calls[1] != 2 {
		t.Fatalf("%d calls; want one for the name and one for the icon", next.calls[1])
	}
}

// A full cache keeps no new entry, but still answers; expired entries are removed first.
func TestAFullCacheRemovesExpiredEntriesFirst(t *testing.T) {
	cache, next, clock := newTestCache()
	ctx := context.Background()
	for id := range catalogMaxEntries {
		if _, err := cache.Item(ctx, domain.ItemID(id+100)); err != nil {
			t.Fatal(err)
		}
	}

	for range 2 {
		if _, err := cache.Item(ctx, 1); err != nil {
			t.Fatal(err)
		}
	}
	if next.calls[1] != 2 || len(cache.entries) != catalogMaxEntries {
		t.Fatalf("%d calls, %d entries; want the new answer given but not kept", next.calls[1], len(cache.entries))
	}

	clock.now = clock.now.Add(catalogFoundTTL)
	if _, err := cache.Item(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if len(cache.entries) != 1 {
		t.Fatalf("%d entries; want the expired ones removed and the new one kept", len(cache.entries))
	}
}

// One sweep after the TTL removes the expired entry and keeps the unexpired one (ADR 0029 Amendment 2026-11-25 item 9).
func TestASweepRemovesOnlyExpiredEntries(t *testing.T) {
	cache, _, clock := newTestCache()
	ctx := context.Background()
	if _, err := cache.Item(ctx, 2); !errors.Is(err, application.ErrItemNotFound) {
		t.Fatal(err)
	}
	if _, err := cache.Item(ctx, 1); err != nil {
		t.Fatal(err)
	}

	clock.now = clock.now.Add(catalogUnknownTTL)
	cache.Sweep()

	if _, kept := cache.entries[key{itemID: 2}]; kept {
		t.Fatal("the expired not-found entry is still kept")
	}
	if _, kept := cache.entries[key{itemID: 1}]; !kept {
		t.Fatal("the unexpired entry was removed")
	}
}

func TestRunSweepsStopsWithTheContext(t *testing.T) {
	cache, _, _ := newTestCache()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		cache.RunSweeps(ctx)
		close(done)
	}()

	cancel()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("RunSweeps did not stop with the context")
	}
}
