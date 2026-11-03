import { useCallback } from "react";
import { errorCodeOf, useApi, type InviteLink } from "../../api";
import { useLoad, type LoadState } from "../../hooks";

export type InviteLinksState =
  | { status: "loading" }
  | { status: "loaded"; links: InviteLink[] }
  | { status: "error"; code: string };

function linksStateOf(load: LoadState<InviteLink[]>): InviteLinksState {
  switch (load.status) {
    case "loading":
      return { status: "loading" };
    case "loaded":
      return { status: "loaded", links: load.value };
    case "failed":
      return { status: "error", code: errorCodeOf(load.error) };
  }
}

/** Loads the active invite links the server lets the caller see. Which links those are is decided by the server. */
export function useInviteLinks(groupId: string, onUnauthenticated: () => void) {
  const api = useApi();
  const listLinks = useCallback(
    () => api.listInviteLinks(groupId),
    [api, groupId],
  );
  const { state, reload } = useLoad(listLinks, onUnauthenticated);
  return { state: linksStateOf(state), reload };
}
