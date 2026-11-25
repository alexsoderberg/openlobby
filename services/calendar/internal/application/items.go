package application

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"

	"openlobby/services/calendar/internal/domain"
)

// ErrItemNotFound means the catalog does not know the item or has no usable icon for it, or the item is on no drop
// list and in no goal (ADR 0029 sections 4 and 5).
var ErrItemNotFound = errors.New("item not found")

// ErrCatalogUnavailable means the item catalog did not answer, pauses after a refusal, or is not configured.
var ErrCatalogUnavailable = errors.New("item catalog unavailable")

// ErrDropItemTaken means the item is already on the drop list (ADR 0029 section 5).
var ErrDropItemTaken = errors.New("drop item taken")

// itemNameBudget is the longest a request waits in total for the catalog's names (ADR 0029 section 5).
const itemNameBudget = 3 * time.Second

// Items holds the use cases of the drop lists and the item catalog (ADR 0029).
type Items struct {
	drops   DropListRepository
	catalog ItemCatalog
	logger  *slog.Logger
}

// NewItems returns the item use cases with their ports.
func NewItems(drops DropListRepository, catalog ItemCatalog, logger *slog.Logger) *Items {
	return &Items{drops: drops, catalog: catalog, logger: logger}
}

// ListGameItems returns the drop-list items of a game to any signed-in person, with their names, filtered by the name
// search. The flag is false when a name of the answer is unavailable, so the search could not match it.
func (i *Items) ListGameItems(ctx context.Context, gameID, activityID, rawQuery string) ([]domain.GameItem, bool, error) {
	query, err := domain.ParseItemSearch(rawQuery)
	if err != nil {
		return nil, false, fmt.Errorf("list game items: %w", err)
	}
	drops, err := i.drops.Drops(ctx, gameID, activityID)
	if err != nil {
		return nil, false, fmt.Errorf("list game items: %w", err)
	}
	items := domain.GameItemsOf(drops, activityID)
	names := make([]*domain.Item, len(items))
	for k := range items {
		names[k] = &items[k].Item
	}
	i.resolveNames(ctx, names)
	items = slices.DeleteFunc(items, func(item domain.GameItem) bool { return !item.MatchesSearch(query) })
	complete := !slices.ContainsFunc(items, func(item domain.GameItem) bool { return item.Status == domain.ItemUnavailable })
	return items, complete, nil
}

// AddDropItem puts an item on a drop list and returns it with its name status, so "Unknown item" shows at once. The
// admin check comes first (ADR 0029 sections 5 and 8).
func (i *Items) AddDropItem(ctx context.Context, actor domain.Actor, gameID, activityID, rawItemID string) (domain.Item, error) {
	itemID, err := i.checkDropWrite(actor, rawItemID)
	if err != nil {
		return domain.Item{}, fmt.Errorf("add drop item: %w", err)
	}
	if err := i.drops.AddDrop(ctx, gameID, activityID, itemID); err != nil {
		return domain.Item{}, fmt.Errorf("add drop item: %w", err)
	}
	i.logChange(ctx, "add", actor, activityID, itemID)
	budget, cancel := context.WithTimeout(ctx, itemNameBudget)
	defer cancel()
	return i.itemOf(budget, itemID), nil
}

// RemoveDropItem takes an item off a drop list. Goals of the item are kept (REQ-0030).
func (i *Items) RemoveDropItem(ctx context.Context, actor domain.Actor, gameID, activityID, rawItemID string) error {
	itemID, err := i.checkDropWrite(actor, rawItemID)
	if err != nil {
		return fmt.Errorf("remove drop item: %w", err)
	}
	if err := i.drops.RemoveDrop(ctx, gameID, activityID, itemID); err != nil {
		return fmt.Errorf("remove drop item: %w", err)
	}
	i.logChange(ctx, "remove", actor, activityID, itemID)
	return nil
}

// ItemIcon returns the icon of an item that is on a drop list or in a goal, so a signed-in person cannot make the
// service fetch any item (ADR 0029 section 8). An unavailable catalog is domain.ErrUnavailable (503).
func (i *Items) ItemIcon(ctx context.Context, rawItemID string) (domain.ItemIcon, error) {
	itemID, err := domain.ParseItemID(rawItemID)
	if err != nil {
		return domain.ItemIcon{}, fmt.Errorf("item icon: %w", err)
	}
	referenced, err := i.drops.IsReferenced(ctx, itemID)
	if err != nil {
		return domain.ItemIcon{}, fmt.Errorf("item icon: %w", err)
	}
	if !referenced {
		return domain.ItemIcon{}, ErrItemNotFound
	}
	icon, err := i.catalog.ItemIcon(ctx, itemID)
	switch {
	case errors.Is(err, ErrItemNotFound):
		return domain.ItemIcon{}, err
	case err != nil:
		return domain.ItemIcon{}, fmt.Errorf("item icon: %w: %w", domain.ErrUnavailable, err)
	}
	return icon, nil
}

// resolveNames sets the name status of each item within itemNameBudget, asking the catalog once per item ID.
func (i *Items) resolveNames(ctx context.Context, items []*domain.Item) {
	budget, cancel := context.WithTimeout(ctx, itemNameBudget)
	defer cancel()
	resolved := map[domain.ItemID]domain.Item{}
	for _, item := range items {
		if _, done := resolved[item.ID]; !done {
			resolved[item.ID] = i.itemOf(budget, item.ID)
		}
		*item = resolved[item.ID]
	}
}

// checkDropWrite is the order of the drop-list writes: the admin check, then the item ID.
func (i *Items) checkDropWrite(actor domain.Actor, rawItemID string) (domain.ItemID, error) {
	if err := requireSystemAdmin(actor); err != nil {
		return 0, err
	}
	return domain.ParseItemID(rawItemID)
}

// itemOf gives the item with its name status: found is known, ErrItemNotFound is unknown, and any other error is
// unavailable. An error that is neither expected nor the end of the budget is logged (ADR 0029 section 4).
func (i *Items) itemOf(ctx context.Context, itemID domain.ItemID) domain.Item {
	found, err := i.catalog.Item(ctx, itemID)
	switch {
	case err == nil:
		return domain.Item{ID: itemID, Name: found.Name, Status: domain.ItemKnown}
	case errors.Is(err, ErrItemNotFound):
		return domain.Item{ID: itemID, Status: domain.ItemUnknown}
	case !errors.Is(err, ErrCatalogUnavailable) && ctx.Err() == nil:
		i.logger.WarnContext(ctx, "item catalog failed", "itemId", int(itemID), "error", err.Error())
	}
	return domain.Item{ID: itemID, Status: domain.ItemUnavailable}
}

// logChange writes who changed which drop list (ADR 0029 section 8).
func (i *Items) logChange(ctx context.Context, action string, actor domain.Actor, activityID string, itemID domain.ItemID) {
	i.logger.InfoContext(ctx, "drop list changed", "action", action, "actorUserId", actor.UserID, "activityId", activityID, "itemId", int(itemID))
}
