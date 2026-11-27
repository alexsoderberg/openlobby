import { useCallback, useState } from "react";
import { useApi, type ChangeResult, type Item } from "../../api";
import { loadViewOf, useChangeAction, useLoad } from "../../hooks";

/**
 * One Named activity's drop list: loads it, and adds and removes items on their own requests, at once and not with
 * the game's Save (ADR 0029 section 6). A write changes the shown list from the server's answer, without a reload.
 */
export function useDropList(
  gameId: string,
  activityId: string,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const load = useCallback(
    () => api.listGameItems(gameId, { activityId }).then((list) => list.items),
    [api, gameId, activityId],
  );
  const { state, reload } = useLoad<Item[]>(load, onUnauthenticated);
  const { busy, run } = useChangeAction(onUnauthenticated);
  // The list after this view's own writes; undefined until the first write.
  const [written, setWritten] = useState<Item[]>();
  const view = loadViewOf(state);
  const items = written ?? (view.status === "loaded" ? view.value : []);

  /** Resolves to the error code of a refusal, or to the added item with its name status. */
  async function add(itemId: number) {
    const answer: { item?: Item } = {};
    const code = await run(async () => {
      answer.item = await api.addDropItem(gameId, activityId, itemId);
    });
    const { item } = answer;
    // Before a first successful load there is no server list to add to, so the list is loaded instead.
    if (item && view.status === "loaded") setWritten([...items, item]);
    else if (item) reload();
    return { code, item };
  }

  const remove = (itemId: number): ChangeResult =>
    run(() => api.removeDropItem(gameId, activityId, itemId));

  /** Takes a removed item off the shown list, after the confirmation has closed. */
  const forget = (itemId: number) =>
    setWritten(items.filter((item) => item.itemId !== itemId));

  return { view, items, busy, add, remove, forget, reload };
}
