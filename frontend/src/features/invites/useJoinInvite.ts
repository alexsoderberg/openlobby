import { useCallback, useState } from "react";
import { errorCodeOf, isUnauthenticated, useApi } from "../../api";
import { INVITE_INVALID } from "./inviteErrors";

export type JoinState =
  | { status: "idle" }
  | { status: "joining" }
  | { status: "failed"; code: string }
  | { status: "invalid" };

/** Joins the group of an invite. A link that stopped working at the click gives "invalid", as on load. */
export function useJoinInvite(
  token: string,
  onGroupOpened: (groupId: string) => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const [state, setState] = useState<JoinState>({ status: "idle" });

  const join = useCallback(async () => {
    setState({ status: "joining" });
    try {
      const group = await api.joinInvite(token);
      onGroupOpened(group.id);
    } catch (error) {
      if (isUnauthenticated(error)) onUnauthenticated();
      else if (errorCodeOf(error) === INVITE_INVALID)
        setState({ status: "invalid" });
      else setState({ status: "failed", code: errorCodeOf(error) });
    }
  }, [api, token, onGroupOpened, onUnauthenticated]);

  return { state, join };
}
