import { useApi, type ChangeResult } from "../../api";
import { useChangeAction } from "../../hooks";
import { GROUP_NOT_FOUND } from "./groupErrors";

/**
 * Leaves a group and resolves to the error code of a failure, or undefined on success, so the dialog can show it.
 * A group that is already gone counts as left. `busy` is true while the call runs.
 */
export function useLeaveGroup(groupId: string, onUnauthenticated: () => void) {
  const api = useApi();
  const { busy, run } = useChangeAction(onUnauthenticated);

  async function leave(): ChangeResult {
    const code = await run(() => api.leaveGroup(groupId));
    return code === GROUP_NOT_FOUND ? undefined : code;
  }

  return { busy, leave };
}
