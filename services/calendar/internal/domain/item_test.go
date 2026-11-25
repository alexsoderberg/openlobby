package domain_test

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"openlobby/services/calendar/internal/domain"
)

// An item ID is a whole number from 1 to the top of the integer column, in decimal digits (ADR 0029 section 3).
func TestParseItemID(t *testing.T) {
	tests := []struct {
		raw     string
		want    domain.ItemID
		wantErr bool
	}{
		{raw: "1", want: 1},
		{raw: "19019", want: 19019},
		{raw: "2147483647", want: 2147483647},
		{raw: "0", wantErr: true},
		{raw: "-5", wantErr: true},
		{raw: "+5", wantErr: true},
		{raw: "2147483648", wantErr: true},
		{raw: "1.5", wantErr: true},
		{raw: "abc", wantErr: true},
		{raw: "", wantErr: true},
		{raw: " 7", wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.raw, func(t *testing.T) {
			got, err := domain.ParseItemID(tc.raw)
			if tc.wantErr {
				if !errors.Is(err, domain.ErrInvalidItem) {
					t.Fatalf("ParseItemID(%q) = %d, %v; want ErrInvalidItem", tc.raw, got, err)
				}
				return
			}
			if err != nil || got != tc.want {
				t.Fatalf("ParseItemID(%q) = %d, %v; want %d", tc.raw, got, err, tc.want)
			}
		})
	}
}

func TestParseItemSearchTrimsAndLimitsTheLength(t *testing.T) {
	if got, err := domain.ParseItemSearch("  Thunder  "); err != nil || got != "Thunder" {
		t.Fatalf("got %q, %v; want the trimmed search", got, err)
	}
	if got, err := domain.ParseItemSearch(strings.Repeat("ä", 50)); err != nil || got == "" {
		t.Fatalf("50 characters: %q, %v; want accepted", got, err)
	}
	if _, err := domain.ParseItemSearch(strings.Repeat("a", 51)); !errors.Is(err, domain.ErrInvalidItemSearch) {
		t.Fatalf("51 characters: %v; want ErrInvalidItemSearch", err)
	}
}

// A known item matches by name ignoring case; an unknown or unavailable item has no name to match, so it is always kept
// (ADR 0029 section 5, search rule).
func TestItemMatchesSearch(t *testing.T) {
	known := domain.Item{ID: 1, Name: "Thunderfury, Blessed Blade", Status: domain.ItemKnown}
	tests := []struct {
		name  string
		item  domain.Item
		query string
		want  bool
	}{
		{name: "empty search", item: known, query: "", want: true},
		{name: "part of the name ignoring case", item: known, query: "blessed BLADE", want: true},
		{name: "not in the name", item: known, query: "sulfuras", want: false},
		{name: "unknown kept", item: domain.Item{ID: 2, Status: domain.ItemUnknown}, query: "sulfuras", want: true},
		{name: "unavailable kept", item: domain.Item{ID: 3, Status: domain.ItemUnavailable}, query: "sulfuras", want: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.item.MatchesSearch(tc.query); got != tc.want {
				t.Fatalf("MatchesSearch(%q) = %v, want %v", tc.query, got, tc.want)
			}
		})
	}
}

// Each item is listed once, at its first place in the order of the drops, with every activity of the game that drops it.
// With an activity, only its items are listed, in its own order (ADR 0029 section 5, ordering).
func TestGameItemsOf(t *testing.T) {
	molten := domain.DropActivity{ActivityID: "a1", ActivityName: "Molten Core", ModeName: "Raid"}
	onyxia := domain.DropActivity{ActivityID: "a2", ActivityName: "Onyxia", ModeName: "Raid"}
	drops := []domain.Drop{
		{ItemID: 10, Activity: molten},
		{ItemID: 20, Activity: molten},
		{ItemID: 30, Activity: onyxia},
		{ItemID: 10, Activity: onyxia},
	}
	both := []domain.DropActivity{molten, onyxia}

	all := domain.GameItemsOf(drops, "")
	want := []domain.GameItem{
		{Item: domain.Item{ID: 10}, DropsIn: both},
		{Item: domain.Item{ID: 20}, DropsIn: []domain.DropActivity{molten}},
		{Item: domain.Item{ID: 30}, DropsIn: []domain.DropActivity{onyxia}},
	}
	if !reflect.DeepEqual(all, want) {
		t.Fatalf("all activities: %+v, want %+v", all, want)
	}

	onlyOnyxia := domain.GameItemsOf(drops, "a2")
	want = []domain.GameItem{
		{Item: domain.Item{ID: 30}, DropsIn: []domain.DropActivity{onyxia}},
		{Item: domain.Item{ID: 10}, DropsIn: both},
	}
	if !reflect.DeepEqual(onlyOnyxia, want) {
		t.Fatalf("one activity: %+v, want %+v", onlyOnyxia, want)
	}

	if empty := domain.GameItemsOf(nil, ""); empty == nil || len(empty) != 0 {
		t.Fatalf("no drops: %#v, want an empty list", empty)
	}
}
