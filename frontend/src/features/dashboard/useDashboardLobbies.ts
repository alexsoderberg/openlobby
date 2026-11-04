import { useCallback } from "react";
import { useApi, type GroupSummary } from "../../api";
import { loadViewOf, useLoad } from "../../hooks";
import { byStart, type DashboardLobby } from "./dashboardLobby";

/**
 * Loads the upcoming lobbies of every group in parallel. One failed request fails the whole load, so
 * a partial set is never shown (ADR 0014). `groups` must be stable, since a change loads again.
 */
export function useDashboardLobbies(
  groups: GroupSummary[],
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const load = useCallback(async (): Promise<DashboardLobby[]> => {
    const perGroup = await Promise.all(
      groups.map(async ({ id, name }) =>
        (await api.listUpcomingLobbies(id)).map((lobby) => ({
          ...lobby,
          groupId: id,
          groupName: name,
        })),
      ),
    );
    return perGroup.flat().sort(byStart);
  }, [api, groups]);
  const { state, reload } = useLoad(load, onUnauthenticated);
  return { state: loadViewOf(state), reload };
}
