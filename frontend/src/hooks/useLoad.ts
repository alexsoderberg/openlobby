import { useCallback, useEffect, useState } from "react";
import { isUnauthenticated } from "../api";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "loaded"; value: T }
  | { status: "failed"; error: unknown };

/**
 * Runs `load` and keeps its outcome. `load` and `onUnauthenticated` must be stable (useCallback), because a change of
 * either runs the load again. With `onUnauthenticated`, an expired session is handed over and the state
 * stays loading, since the page is left. Without it, the error is kept for the caller to read.
 */
export function useLoad<T>(
  load: () => Promise<T>,
  onUnauthenticated?: () => void,
) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    load().then(
      (value) => {
        if (!ignore) setState({ status: "loaded", value });
      },
      (error: unknown) => {
        if (ignore) return;
        if (onUnauthenticated && isUnauthenticated(error)) onUnauthenticated();
        else setState({ status: "failed", error });
      },
    );
    return () => {
      ignore = true;
    };
  }, [load, onUnauthenticated, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  return { state, reload };
}
