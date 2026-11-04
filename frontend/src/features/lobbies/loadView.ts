import { errorCodeOf } from "../../api";
import type { LoadState } from "../../hooks";

/** A load as a view needs it: the value, or the error code to show. */
export type LoadView<T> =
  | { status: "loading" }
  | { status: "loaded"; value: T }
  | { status: "error"; code: string };

export function loadViewOf<T>(load: LoadState<T>): LoadView<T> {
  return load.status === "failed"
    ? { status: "error", code: errorCodeOf(load.error) }
    : load;
}
