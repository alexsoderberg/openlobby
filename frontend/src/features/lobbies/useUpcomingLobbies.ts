import { useCallback } from "react";
import { useApi } from "../../api";
import { useLoad } from "../../hooks";
import { loadViewOf } from "./loadView";

/** Loads the group's upcoming lobbies, sorted by the server. `refresh` reloads without a loading flash. */
export function useUpcomingLobbies(
  groupId: string,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const list = useCallback(
    () => api.listUpcomingLobbies(groupId),
    [api, groupId],
  );
  const { state, reload, refresh } = useLoad(list, onUnauthenticated);
  return { state: loadViewOf(state), reload, refresh };
}
