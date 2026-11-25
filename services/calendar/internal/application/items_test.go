package application_test

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"reflect"
	"strings"
	"testing"
	"time"

	"openlobby/services/calendar/internal/application"
	"openlobby/services/calendar/internal/domain"
)

const activityID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1"

var moltenCore = domain.DropActivity{ActivityID: activityID, ActivityName: "Molten Core", ModeName: "Raid"}

// fakeDrops keeps the drop lists in memory and counts the writes, so a test can show that nothing was written.
type fakeDrops struct {
	drops      []domain.Drop
	referenced map[domain.ItemID]bool
	err        error
	writes     int
}

func (f *fakeDrops) Drops(context.Context, string, string) ([]domain.Drop, error) {
	return f.drops, f.err
}

func (f *fakeDrops) AddDrop(_ context.Context, _, _ string, itemID domain.ItemID) error {
	f.writes++
	if f.err == nil {
		f.drops = append(f.drops, domain.Drop{ItemID: itemID, Activity: moltenCore})
	}
	return f.err
}

func (f *fakeDrops) RemoveDrop(context.Context, string, string, domain.ItemID) error {
	f.writes++
	return f.err
}

func (f *fakeDrops) IsReferenced(_ context.Context, itemID domain.ItemID) (bool, error) {
	return f.referenced[itemID], f.err
}

// fakeItemCatalog answers names and icons by item ID; an item in errs gives that error. It keeps the deadline it saw.
type fakeItemCatalog struct {
	names    map[domain.ItemID]string
	errs     map[domain.ItemID]error
	icon     domain.ItemIcon
	deadline time.Time
	calls    int
}

func (f *fakeItemCatalog) Item(ctx context.Context, itemID domain.ItemID) (domain.CatalogItem, error) {
	f.calls++
	f.deadline, _ = ctx.Deadline()
	if err := f.errs[itemID]; err != nil {
		return domain.CatalogItem{}, err
	}
	return domain.CatalogItem{Name: f.names[itemID]}, nil
}

func (f *fakeItemCatalog) ItemIcon(_ context.Context, itemID domain.ItemID) (domain.ItemIcon, error) {
	f.calls++
	if err := f.errs[itemID]; err != nil {
		return domain.ItemIcon{}, err
	}
	return f.icon, nil
}

// thunderfury is known, 2 is unknown to the catalog and 3 is not answered.
func dropCatalog() *fakeItemCatalog {
	return &fakeItemCatalog{
		names: map[domain.ItemID]string{1: "Thunderfury"},
		errs:  map[domain.ItemID]error{2: application.ErrItemNotFound, 3: application.ErrCatalogUnavailable},
	}
}

func dropsOf(ids ...domain.ItemID) *fakeDrops {
	drops := &fakeDrops{}
	for _, id := range ids {
		drops.drops = append(drops.drops, domain.Drop{ItemID: id, Activity: moltenCore})
	}
	return drops
}

// Found is known, not found is unknown, and unavailable keeps the search from being complete (ADR 0029 section 4).
func TestListGameItemsResolvesTheNameStatus(t *testing.T) {
	catalog := dropCatalog()
	items, complete, err := application.NewItems(dropsOf(1, 2, 3), catalog, discardLog()).ListGameItems(context.Background(), gameID, "", "")

	want := []domain.GameItem{
		{Item: domain.Item{ID: 1, Name: "Thunderfury", Status: domain.ItemKnown}, DropsIn: []domain.DropActivity{moltenCore}},
		{Item: domain.Item{ID: 2, Status: domain.ItemUnknown}, DropsIn: []domain.DropActivity{moltenCore}},
		{Item: domain.Item{ID: 3, Status: domain.ItemUnavailable}, DropsIn: []domain.DropActivity{moltenCore}},
	}
	if err != nil || complete || !reflect.DeepEqual(items, want) {
		t.Fatalf("items %+v, complete %v, error %v; want %+v, not complete", items, complete, err, want)
	}
	if left := time.Until(catalog.deadline); left <= 0 || left > 3*time.Second {
		t.Fatalf("catalog deadline in %v; want within the 3 s name budget", left)
	}
}

// A known item that does not match leaves; items without a name stay, and with all names known the search is complete.
func TestListGameItemsFiltersKnownNamesOnly(t *testing.T) {
	items, complete, err := application.NewItems(dropsOf(1, 2), dropCatalog(), discardLog()).ListGameItems(context.Background(), gameID, "", " sulfuras ")

	if err != nil || !complete || len(items) != 1 || items[0].ID != 2 {
		t.Fatalf("items %+v, complete %v, error %v; want only the unknown item, complete", items, complete, err)
	}
}

func TestListGameItemsRefusesALongSearchBeforeTheRead(t *testing.T) {
	drops := dropsOf(1)
	drops.err = application.ErrGameNotFound

	_, _, err := application.NewItems(drops, dropCatalog(), discardLog()).ListGameItems(context.Background(), gameID, "", strings.Repeat("a", 51))

	if !errors.Is(err, domain.ErrInvalidItemSearch) {
		t.Fatalf("error %v; want ErrInvalidItemSearch before game_not_found", err)
	}
}

func TestListGameItemsPassesTheRepositoryError(t *testing.T) {
	drops := &fakeDrops{err: domain.ErrInvalidActivity}

	_, _, err := application.NewItems(drops, dropCatalog(), discardLog()).ListGameItems(context.Background(), gameID, activityID, "")

	if !errors.Is(err, domain.ErrInvalidActivity) {
		t.Fatalf("error %v; want ErrInvalidActivity", err)
	}
}

// An unexpected catalog error is unavailable and logged; the expected ones are not logged.
func TestListGameItemsLogsAnUnexpectedCatalogError(t *testing.T) {
	catalog := dropCatalog()
	catalog.errs[4] = errors.New("boom")
	var logged bytes.Buffer

	items, _, err := application.NewItems(dropsOf(2, 3, 4), catalog, slog.New(slog.NewTextHandler(&logged, nil))).ListGameItems(context.Background(), gameID, "", "")

	if err != nil || items[2].Status != domain.ItemUnavailable {
		t.Fatalf("items %+v, error %v; want the third unavailable", items, err)
	}
	if got := strings.Count(logged.String(), "item catalog failed"); got != 1 {
		t.Fatalf("logged %q; want one warning for the unexpected error", logged.String())
	}
}

// The admin check comes first, then the item ID, and nothing is written on a refusal (ADR 0029 sections 5 and 8).
func TestDropListWritesCheckInOrder(t *testing.T) {
	tests := []struct {
		name  string
		actor domain.Actor
		item  string
		want  error
	}{
		{name: "not a system admin", actor: nonAdmin, item: "abc", want: domain.ErrNotAllowed},
		{name: "invalid item", actor: admin, item: "0", want: domain.ErrInvalidItem},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			drops := dropsOf()
			items := application.NewItems(drops, dropCatalog(), discardLog())

			_, addErr := items.AddDropItem(context.Background(), tc.actor, gameID, activityID, tc.item)
			removeErr := items.RemoveDropItem(context.Background(), tc.actor, gameID, activityID, tc.item)

			if !errors.Is(addErr, tc.want) || !errors.Is(removeErr, tc.want) || drops.writes != 0 {
				t.Fatalf("add %v, remove %v, writes %d; want %v and no write", addErr, removeErr, drops.writes, tc.want)
			}
		})
	}
}

// An item Blizzard does not know is stored, and the answer says so at once (REQ-0030).
func TestAddDropItemReturnsTheNameStatus(t *testing.T) {
	drops := dropsOf()
	var logged bytes.Buffer

	item, err := application.NewItems(drops, dropCatalog(), slog.New(slog.NewTextHandler(&logged, nil))).AddDropItem(context.Background(), admin, gameID, activityID, "2")

	if err != nil || item != (domain.Item{ID: 2, Status: domain.ItemUnknown}) || len(drops.drops) != 1 {
		t.Fatalf("item %+v, error %v, drops %+v; want the unknown item stored", item, err, drops.drops)
	}
	if !strings.Contains(logged.String(), "drop list changed") || !strings.Contains(logged.String(), aliceID) {
		t.Fatalf("log %q; want who changed the drop list", logged.String())
	}
}

func TestAddDropItemPassesTaken(t *testing.T) {
	drops := &fakeDrops{err: application.ErrDropItemTaken}

	_, err := application.NewItems(drops, dropCatalog(), discardLog()).AddDropItem(context.Background(), admin, gameID, activityID, "1")

	if !errors.Is(err, application.ErrDropItemTaken) {
		t.Fatalf("error %v; want ErrDropItemTaken", err)
	}
}

// The icon is only fetched for an item on a drop list or in a goal (ADR 0029 section 8).
func TestItemIcon(t *testing.T) {
	icon := domain.ItemIcon{MediaType: "image/png", Bytes: []byte{1}}
	tests := []struct {
		name       string
		item       string
		referenced bool
		want       error
		wantCalls  int
	}{
		{name: "invalid item", item: "x", want: domain.ErrInvalidItem},
		{name: "on no list and in no goal", item: "1", want: application.ErrItemNotFound},
		{name: "referenced", item: "1", referenced: true, wantCalls: 1},
		{name: "unknown to the catalog", item: "2", referenced: true, want: application.ErrItemNotFound, wantCalls: 1},
		{name: "catalog unavailable", item: "3", referenced: true, want: domain.ErrUnavailable, wantCalls: 1},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			catalog := dropCatalog()
			catalog.icon = icon
			id, _ := domain.ParseItemID(tc.item)
			drops := &fakeDrops{referenced: map[domain.ItemID]bool{id: tc.referenced}}

			got, err := application.NewItems(drops, catalog, discardLog()).ItemIcon(context.Background(), tc.item)

			if !errors.Is(err, tc.want) || catalog.calls != tc.wantCalls {
				t.Fatalf("error %v, catalog calls %d; want %v, %d", err, catalog.calls, tc.want, tc.wantCalls)
			}
			if tc.want == nil && !reflect.DeepEqual(got, icon) {
				t.Fatalf("icon %+v, want %+v", got, icon)
			}
		})
	}
}
