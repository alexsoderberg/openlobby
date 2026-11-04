import { useCallback } from "react";
import { errorCodeOf, useApi, type Game } from "../../api";
import { useLoad, type LoadState } from "../../hooks";

export type GamesState =
  | { status: "loading" }
  | { status: "loaded"; games: Game[] }
  | { status: "error"; code: string };

function gamesStateOf(load: LoadState<Game[]>): GamesState {
  switch (load.status) {
    case "loading":
      return { status: "loading" };
    case "loaded":
      return { status: "loaded", games: load.value };
    case "failed":
      return { status: "error", code: errorCodeOf(load.error) };
  }
}

/** Loads the game list in the order the server gives it. Who may see it is decided by the server. */
export function useGames(onUnauthenticated: () => void) {
  const api = useApi();
  const listGames = useCallback(() => api.listGames(), [api]);
  const { state, reload, refresh } = useLoad(listGames, onUnauthenticated);
  return { state: gamesStateOf(state), reload, refresh };
}
