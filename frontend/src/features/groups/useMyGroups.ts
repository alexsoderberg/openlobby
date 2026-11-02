import { useCallback, useEffect, useState } from "react";
import {
  errorCodeOf,
  isUnauthenticated,
  useApi,
  type GroupSummary,
} from "../../api";

export type GroupsState =
  | { status: "loading" }
  | { status: "loaded"; groups: GroupSummary[] }
  | { status: "error"; code: string };

/** Loads the caller's groups. A 401 means the session ended, which is reported to the caller. */
export function useMyGroups(onUnauthenticated: () => void) {
  const api = useApi();
  const [state, setState] = useState<GroupsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    api.listGroups().then(
      (groups) => {
        if (!ignore) setState({ status: "loaded", groups });
      },
      (error: unknown) => {
        if (ignore) return;
        if (isUnauthenticated(error)) onUnauthenticated();
        else setState({ status: "error", code: errorCodeOf(error) });
      },
    );
    return () => {
      ignore = true;
    };
  }, [api, attempt, onUnauthenticated]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  return { state, reload };
}
