import { useState } from "react";
import {
  errorCodeOf,
  isUnauthenticated,
  useApi,
  type ChangeResult,
} from "../../api";

/**
 * Makes a member a group admin and resolves to the error code of a failure, or undefined on success, so the dialog
 * can show it. `onSettled` runs after every outcome, so the member list shows what is true now. `busy` is true while the call runs.
 */
export function useMakeGroupAdmin(
  groupId: string,
  onSettled: () => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const [busy, setBusy] = useState(false);

  async function make(userId: string): ChangeResult {
    setBusy(true);
    try {
      await api.makeGroupAdmin(groupId, userId);
      return undefined;
    } catch (error) {
      if (isUnauthenticated(error)) onUnauthenticated();
      return errorCodeOf(error);
    } finally {
      setBusy(false);
      onSettled();
    }
  }

  return { busy, make };
}
