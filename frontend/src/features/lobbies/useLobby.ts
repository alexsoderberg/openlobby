import { useCallback } from "react";
import { errorCodeOf, useApi, type LobbyDetail } from "../../api";
import { useLoad, type LoadState } from "../../hooks";
import { GROUP_NOT_FOUND, LOBBY_NOT_FOUND } from "./lobbyErrors";

export type LobbyState =
  | { status: "loading" }
  | { status: "loaded"; lobby: LobbyDetail }
  | { status: "notFound" }
  | { status: "error"; code: string };

function lobbyStateOf(load: LoadState<LobbyDetail>): LobbyState {
  switch (load.status) {
    case "loading":
      return load;
    case "loaded":
      return { status: "loaded", lobby: load.value };
    case "failed": {
      const code = errorCodeOf(load.error);
      // A lobby that has ended, a missing one and a non-member's group all look the same.
      return code === LOBBY_NOT_FOUND || code === GROUP_NOT_FOUND
        ? { status: "notFound" }
        : { status: "error", code };
    }
  }
}

/** Loads one lobby with its players. */
export function useLobby(
  groupId: string,
  lobbyId: string,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const get = useCallback(
    () => api.getLobby(groupId, lobbyId),
    [api, groupId, lobbyId],
  );
  const { state, reload } = useLoad(get, onUnauthenticated);
  return { state: lobbyStateOf(state), reload };
}
