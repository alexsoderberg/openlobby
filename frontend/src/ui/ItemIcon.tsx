import { useState } from "react";
import { itemIconUrl } from "../api";

/**
 * An item's icon from our own origin (ADR 0029). Decorative: the caller shows the name as text beside it. An icon
 * that fails to load is not shown, so no broken image appears.
 */
export function ItemIcon({ itemId }: { itemId: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      data-slot="item-icon"
      src={itemIconUrl(itemId)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
