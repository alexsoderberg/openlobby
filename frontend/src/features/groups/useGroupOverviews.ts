import { useCallback } from "react";
import { useApi, type GroupOverview } from "../../api";
import { loadViewOf, useLoad } from "../../hooks";

/** The cards and the time they arrived, which is when "Running" is judged, as the cards do not update live. */
export type GroupOverviews = { groups: GroupOverview[]; loadedAt: number };

/** Loads the Group list's cards in one request, sorted by the server. No live updates (REQ-0024). */
export function useGroupOverviews(onUnauthenticated: () => void) {
  const api = useApi();
  const list = useCallback(
    async (): Promise<GroupOverviews> => ({
      groups: await api.listGroupOverviews(),
      loadedAt: Date.now(),
    }),
    [api],
  );
  const { state, reload } = useLoad(list, onUnauthenticated);
  return { state: loadViewOf(state), reload };
}
