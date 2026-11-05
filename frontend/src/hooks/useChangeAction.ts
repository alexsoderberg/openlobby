import { useCallback, useState } from "react";
import { errorCodeOf, isUnauthenticated, type ChangeResult } from "../api";

/**
 * Runs one change (create, delete, join or leave) and resolves to the error code of a failure, or undefined on
 * success, so the form or dialog that asked can show it. `busy` is true while it runs.
 */
export function useChangeAction(onUnauthenticated: () => void) {
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (action: () => Promise<unknown>): ChangeResult => {
      setBusy(true);
      try {
        await action();
        return undefined;
      } catch (error) {
        if (isUnauthenticated(error)) onUnauthenticated();
        return errorCodeOf(error);
      } finally {
        setBusy(false);
      }
    },
    [onUnauthenticated],
  );

  return { busy, run };
}
