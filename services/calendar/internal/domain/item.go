package domain

import (
	"errors"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"
)

// MaxItemIconBytes is the largest item icon that is accepted and kept in the cache (ADR 0029 section 4).
const MaxItemIconBytes = 16 << 10

// maxItemSearchLength is the longest name search, counted in code points after trim (ADR 0029 section 5).
const maxItemSearchLength = 50

// itemIDBits is the size of the database column of an item ID: integer, up to 2^31 - 1 (ADR 0029 section 3).
const itemIDBits = 31

// ErrInvalidItem means an item ID is not a whole number from 1 to 2^31 - 1 (ADR 0029 section 5).
var ErrInvalidItem = errors.New("invalid item")

// ErrInvalidItemSearch means the name search is longer than maxItemSearchLength after trim.
var ErrInvalidItemSearch = errors.New("invalid item search")

// ItemID is a game item ID, as the item catalog numbers items. The app stores only the number and its own links to it
// (ADR 0029 C1).
type ItemID int

// ParseItemID reads an item ID written in decimal digits. A sign, a space or zero is invalid.
func ParseItemID(raw string) (ItemID, error) {
	id, err := strconv.ParseUint(raw, 10, itemIDBits)
	if err != nil || id < 1 {
		return 0, ErrInvalidItem
	}
	return ItemID(id), nil
}

// ParseItemSearch trims the name search and refuses one that is too long. Empty means no filter.
func ParseItemSearch(raw string) (string, error) {
	query := strings.TrimSpace(raw)
	if utf8.RuneCountInString(query) > maxItemSearchLength {
		return "", ErrInvalidItemSearch
	}
	return query, nil
}

// CatalogItem is what the item catalog gives about an item: its English name. Kept in memory only (ADR 0029 C2).
type CatalogItem struct {
	Name string
}

// ItemIcon is the icon of an item: JPEG or PNG, at most MaxItemIconBytes. Kept in memory only (ADR 0029 C2).
type ItemIcon struct {
	MediaType string
	Bytes     []byte
}

// ItemStatus tells whether the catalog gave the name of an item (ADR 0029 section 4).
type ItemStatus string

const (
	ItemKnown       ItemStatus = "known"
	ItemUnknown     ItemStatus = "unknown"
	ItemUnavailable ItemStatus = "unavailable"
)

// Item is an item ID with its name as resolved for one request. Name is set only when Status is ItemKnown.
type Item struct {
	ID     ItemID
	Name   string
	Status ItemStatus
}

// MatchesSearch keeps a known item whose name contains the query, ignoring case. An item without a name cannot be
// matched, so it is always kept (ADR 0029 section 5, search rule).
func (i Item) MatchesSearch(query string) bool {
	return i.Status != ItemKnown || strings.Contains(strings.ToLower(i.Name), strings.ToLower(query))
}

// DropActivity is a Named activity whose drop list has an item.
type DropActivity struct {
	ActivityID   string
	ActivityName string
	ModeName     string
}

// Drop is one entry of a drop list.
type Drop struct {
	ItemID   ItemID
	Activity DropActivity
}

// GameItem is an item of a game's drop lists with the activities that drop it.
type GameItem struct {
	Item
	DropsIn []DropActivity
}

// GameItemsOf lists each item once, at its first place among the drops (given in the game's order), with every activity
// of the drops that has it. With an activity ID, only the items of that activity are listed, in its order.
func GameItemsOf(drops []Drop, activityID string) []GameItem {
	dropsIn := map[ItemID][]DropActivity{}
	for _, drop := range drops {
		dropsIn[drop.ItemID] = append(dropsIn[drop.ItemID], drop.Activity)
	}
	items := []GameItem{}
	for _, drop := range drops {
		listed := slices.ContainsFunc(items, func(item GameItem) bool { return item.ID == drop.ItemID })
		if listed || (activityID != "" && drop.Activity.ActivityID != activityID) {
			continue
		}
		items = append(items, GameItem{Item: Item{ID: drop.ItemID}, DropsIn: dropsIn[drop.ItemID]})
	}
	return items
}
