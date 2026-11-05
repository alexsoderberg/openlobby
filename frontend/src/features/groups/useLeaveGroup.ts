import { useState } from "react";
import {
  errorCodeOf,
  isUnauthenticated,
  useApi,
  type ChangeResult,
} from "../../api";
import { GROUP_NOT_FOUND } from "./groupErrors";

/**
 * Leaves a group and resolves to the error code of a failure, or undefined on success, so the dialog can show it.
 * A group that is already gone counts as left. `busy` is true while the call runs.
 */
export function useLeaveGroup(groupId: string, onUnauthenticated: () => void) {
  const api = useApi();
  const [busy, setBusy] = useState(false);

  async function leave(): ChangeResult {
    setBusy(true);
    try {
      await api.leaveGroup(groupId);
      return undefined;
    } catch (error) {
      if (isUnauthenticated(error)) onUnauthenticated();
      const code = errorCodeOf(error);
      return code === GROUP_NOT_FOUND ? undefined : code;
    } finally {
      setBusy(false);
    }
  }

  return { busy, leave };
}
