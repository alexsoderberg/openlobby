import { useRef } from "react";
import { useApi, type ChangeResult } from "../../api";
import { useChangeAction } from "../../hooks";

/**
 * Makes a member a group admin and resolves to the error code of a failure, or undefined on success, so the dialog
 * can show it. `onSettled` runs after every outcome but an ended session, so the member list shows what is true now.
 * `busy` is true while the call runs.
 */
export function useMakeGroupAdmin(
  groupId: string,
  onSettled: () => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const sessionEnded = useRef(false);
  const { busy, run } = useChangeAction(() => {
    sessionEnded.current = true;
    onUnauthenticated();
  });

  async function make(userId: string): ChangeResult {
    sessionEnded.current = false;
    const code = await run(() => api.makeGroupAdmin(groupId, userId));
    if (!sessionEnded.current) onSettled();
    return code;
  }

  return { busy, make };
}
