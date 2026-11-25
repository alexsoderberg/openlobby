import type { Item } from "../api";
import { useMessages, type Messages } from "../i18n";
import { ItemIcon } from "./ItemIcon";

/** The text that stands for an item without a name: "Unknown item" when Blizzard does not know it, else "Item". */
function fallbackName(item: Item, m: Messages): string {
  return item.status === "unknown" ? m.itemUnknown : m.itemFallbackName;
}

/** The item as one line of text: its name, or "Unknown item" or "Item" with its ID (REQ-0030). For labels. */
export function itemText(item: Item, m: Messages): string {
  if (item.status === "known" && item.name) return item.name;
  return `${fallbackName(item, m)} ${m.itemId(item.itemId)}`;
}

/**
 * An item: its icon when Blizzard knows it, its name, and its ID below. An Unknown item and an item whose name is
 * not available show their fallback text and no icon (REQ-0030). The icon box stays, so the names line up.
 */
export function ItemLabel({ item }: { item: Item }) {
  const m = useMessages();
  const known = item.status === "known" && item.name;
  return (
    <span data-slot="item-label">
      <span className="item-label__icon">
        {known && <ItemIcon itemId={item.itemId} />}
      </span>
      <span className="item-label__text">
        <span className="item-label__name">
          {known ? item.name : fallbackName(item, m)}
        </span>
        <span className="item-label__meta">
          {m.itemId(item.itemId)}
          {item.status === "unavailable" && ` · ${m.itemNameUnavailable}`}
        </span>
      </span>
    </span>
  );
}
