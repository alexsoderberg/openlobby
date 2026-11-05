import { useCallback } from "react";
import { errorCodeOf, useApi, type Group } from "../../api";
import { useLoad, type LoadState } from "../../hooks";
import { GROUP_NOT_FOUND } from "./groupErrors";

export type GroupState =
  | { status: "loading" }
  | { status: "loaded"; group: Group }
  | { status: "notFound" }
  | { status: "error"; code: string };

function groupStateOf(load: LoadState<Group>): GroupState {
  switch (load.status) {
    case "loading":
      return { status: "loading" };
    case "loaded":
      return { status: "loaded", group: load.value };
    case "failed": {
      const code = errorCodeOf(load.error);
      return code === GROUP_NOT_FOUND
        ? { status: "notFound" }
        : { status: "error", code };
    }
  }
}

/** Loads one group. `refresh` loads again without leaving the page. A non-member gets notFound, the same as an unknown group, and no group data. */
export function useGroup(groupId: string, onUnauthenticated: () => void) {
  const api = useApi();
  const getGroup = useCallback(() => api.getGroup(groupId), [api, groupId]);
  const { state, reload, refresh } = useLoad(getGroup, onUnauthenticated);
  return { state: groupStateOf(state), reload, refresh };
}
