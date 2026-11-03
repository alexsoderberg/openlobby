import { useCallback, useState } from "react";
import { errorCodeOf, isUnauthenticated, useApi } from "../../api";
import { INVITE_INVALID } from "./inviteErrors";

type InviteLinkChangeState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "done"; change: "created" | "revoked" }
  | { status: "failed"; code: string };

/** Creates and revokes links. Either change refreshes the list, so the server stays the source of truth. */
export function useInviteLinkChanges(
  groupId: string,
  onChanged: () => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const [state, setState] = useState<InviteLinkChangeState>({ status: "idle" });

  const change = useCallback(
    async (
      done: "created" | "revoked",
      action: () => Promise<unknown>,
    ): Promise<void> => {
      setState({ status: "saving" });
      try {
        await action();
        setState({ status: "done", change: done });
        onChanged();
      } catch (error) {
        if (isUnauthenticated(error)) {
          onUnauthenticated();
          return;
        }
        const code = errorCodeOf(error);
        setState({ status: "failed", code });
        // A link that stopped working is gone from the server's list, so the list is refreshed.
        if (code === INVITE_INVALID) onChanged();
      }
    },
    [onChanged, onUnauthenticated],
  );

  const create = useCallback(
    (maxUses: number) =>
      change("created", () => api.createInviteLink(groupId, maxUses)),
    [api, change, groupId],
  );

  const revoke = useCallback(
    (linkId: string) =>
      change("revoked", () => api.revokeInviteLink(groupId, linkId)),
    [api, change, groupId],
  );

  return { state, create, revoke };
}
