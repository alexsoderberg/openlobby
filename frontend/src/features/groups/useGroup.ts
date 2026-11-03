import { useCallback, useEffect, useState } from "react";
import { errorCodeOf, isUnauthenticated, useApi, type Group } from "../../api";
import { GROUP_NOT_FOUND } from "./groupErrors";

export type GroupState =
  | { status: "loading" }
  | { status: "loaded"; group: Group }
  | { status: "notFound" }
  | { status: "error"; code: string };

/** Loads one group. A non-member gets notFound, the same as an unknown group, and no group data. */
export function useGroup(groupId: string, onUnauthenticated: () => void) {
  const api = useApi();
  const [state, setState] = useState<GroupState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    api.getGroup(groupId).then(
      (group) => {
        if (!ignore) setState({ status: "loaded", group });
      },
      (error: unknown) => {
        if (ignore) return;
        if (isUnauthenticated(error)) onUnauthenticated();
        else if (errorCodeOf(error) === GROUP_NOT_FOUND)
          setState({ status: "notFound" });
        else setState({ status: "error", code: errorCodeOf(error) });
      },
    );
    return () => {
      ignore = true;
    };
  }, [api, groupId, attempt, onUnauthenticated]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  return { state, reload };
}
