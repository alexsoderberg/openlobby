import { useCallback } from "react";
import { useApi } from "../../api";
import { useLoad } from "../../hooks";
import { loadViewOf } from "./loadView";

/** Loads the group's games, most used first. "Other" is not among them. */
export function useGroupGames(groupId: string, onUnauthenticated: () => void) {
  const api = useApi();
  const list = useCallback(() => api.listGroupGames(groupId), [api, groupId]);
  const { state, reload } = useLoad(list, onUnauthenticated);
  return { state: loadViewOf(state), reload };
}
