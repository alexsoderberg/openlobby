import { useCallback, useState } from "react";
import {
  errorCodeOf,
  isUnauthenticated,
  useApi,
  type GameInput,
} from "../../api";
import { GAME_NOT_FOUND, type ChangeResult } from "./gameErrors";

export type GameChange = "added" | "changed" | "removed";

export type GameChangeState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "done"; change: GameChange }
  | { status: "gone"; code: string };

/**
 * Adds, changes and removes games. Each call resolves to the error code of a failure, or undefined on
 * success, so the form or dialog that asked can show it. A success refreshes the list.
 */
export function useGameChanges(
  onChanged: () => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const [state, setState] = useState<GameChangeState>({ status: "idle" });

  const change = useCallback(
    async (done: GameChange, action: () => Promise<unknown>): ChangeResult => {
      setState({ status: "saving" });
      try {
        await action();
        setState({ status: "done", change: done });
        onChanged();
        return undefined;
      } catch (error) {
        if (isUnauthenticated(error)) onUnauthenticated();
        const code = errorCodeOf(error);
        // A game that is gone from the server is gone from the list too. The page keeps the message
        // and closes the form or dialog, so the message is shown once.
        if (code === GAME_NOT_FOUND) {
          setState({ status: "gone", code });
          onChanged();
        } else setState({ status: "idle" });
        return code;
      }
    },
    [onChanged, onUnauthenticated],
  );

  const add = useCallback(
    (input: GameInput) => change("added", () => api.createGame(input)),
    [api, change],
  );
  const replace = useCallback(
    (gameId: string, input: GameInput) =>
      change("changed", () => api.replaceGame(gameId, input)),
    [api, change],
  );
  const remove = useCallback(
    (gameId: string) => change("removed", () => api.deleteGame(gameId)),
    [api, change],
  );

  return { state, add, replace, remove };
}
