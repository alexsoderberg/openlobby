import { useCallback, useEffect } from "react";
import { errorCodeOf, useApi, type InviteInfo } from "../../api";
import { useLoad, type LoadState } from "../../hooks";
import { INVITE_INVALID } from "./inviteErrors";
import { useJoinInvite } from "./useJoinInvite";

type InviteState =
  | { status: "loading" }
  | { status: "opening" }
  | { status: "invalid" }
  | { status: "error"; code: string }
  | { status: "invitation"; info: InviteInfo };

const INVALID: InviteState = { status: "invalid" };

function inviteStateOf(load: LoadState<InviteInfo>): InviteState {
  switch (load.status) {
    case "loading":
      return { status: "loading" };
    case "loaded":
      // A member is taken straight to the group, so no invitation is shown.
      return load.value.isMember
        ? { status: "opening" }
        : { status: "invitation", info: load.value };
    case "failed": {
      const code = errorCodeOf(load.error);
      return code === INVITE_INVALID ? INVALID : { status: "error", code };
    }
  }
}

/**
 * Loads an invite and joins its group. Opening a link as a member changes nothing and is not
 * counted. A link that stopped working gives the same invalid state on load and at the click.
 */
export function useInvite(
  token: string,
  onGroupOpened: (groupId: string) => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const getInvite = useCallback(() => api.getInvite(token), [api, token]);
  const { state: load, reload } = useLoad(getInvite, onUnauthenticated);
  const { state: join, join: joinGroup } = useJoinInvite(
    token,
    onGroupOpened,
    onUnauthenticated,
  );

  const memberGroupId =
    load.status === "loaded" && load.value.isMember
      ? load.value.groupId
      : undefined;
  useEffect(() => {
    if (memberGroupId !== undefined) onGroupOpened(memberGroupId);
  }, [memberGroupId, onGroupOpened]);

  const state = join.status === "invalid" ? INVALID : inviteStateOf(load);
  return { state, joinState: join, join: joinGroup, reload };
}
