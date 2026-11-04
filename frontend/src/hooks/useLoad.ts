import { useCallback, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { isUnauthenticated } from "../api";
import { trackLoad } from "./pageLoads";

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

  // A layout effect, so the first load is already registered when a view transition has committed the page.
  useLayoutEffect(() => {
    let ignore = false;
    // flushSync commits the outcome inside the handler, so the tracked promise settles only once the screen shows it.
    const loading = load().then(
      (value) => {
        if (!ignore) flushSync(() => setState({ status: "loaded", value }));
      },
      (error: unknown) => {
        if (ignore) return;
        if (onUnauthenticated && isUnauthenticated(error)) onUnauthenticated();
        else flushSync(() => setState({ status: "failed", error }));
      },
    );
    if (attempt === 0) trackLoad(loading);
    return () => {
      ignore = true;
    };
  }, [load, onUnauthenticated, attempt]);

  /** Loads again and keeps showing the current value until the new one arrives. */
  const refresh = useCallback(() => setAttempt((count) => count + 1), []);

  /** Loads again from the loading state, e.g. to retry after a failure. */
  const reload = useCallback(() => {
    setState({ status: "loading" });
    refresh();
  }, [refresh]);

  return { state, reload, refresh };
}
