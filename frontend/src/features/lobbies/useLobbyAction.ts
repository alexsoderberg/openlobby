import { useCallback, useState } from "react";
import { errorCodeOf, isUnauthenticated } from "../../api";
import type { SaveResult } from "./lobbyErrors";

/**
 * Runs one change (create or delete) and resolves to the error code of a failure, or undefined on
 * success, so the form or dialog that asked can show it. `busy` is true while it runs.
 */
export function useLobbyAction(onUnauthenticated: () => void) {
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (action: () => Promise<unknown>): SaveResult => {
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
