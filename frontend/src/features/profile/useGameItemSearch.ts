import { useCallback, useEffect, useState } from "react";
import { useApi, type GameItem } from "../../api";
import { loadViewOf, useLoad } from "../../hooks";

/** The wait after the last keystroke before the name search asks the server, so one word is one request. */
const SEARCH_DELAY_MS = 250;

type DropActivity = GameItem["dropsIn"][number];

/** The Named activities that have items, each once, in the order the server lists the items (game order). */
function activitiesOf(items: GameItem[]): DropActivity[] {
  const byId = new Map<string, DropActivity>();
  for (const activity of items.flatMap((item) => item.dropsIn))
    if (!byId.has(activity.activityId)) byId.set(activity.activityId, activity);
  return [...byId.values()];
}

/**
 * Searches one game's drop-list items by name and by dungeon or raid (ADR 0029 section 6); the server does the
 * matching. The dungeons and raids to choose from come from the answer with no filter, the first one asked.
 */
export function useGameItemSearch(
  gameId: string,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [activityId, setActivityId] = useState("");
  const [activities, setActivities] = useState<DropActivity[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const load = useCallback(async () => {
    const list = await api.listGameItems(gameId, {
      q: query || undefined,
      activityId: activityId || undefined,
    });
    if (!query && !activityId) setActivities(activitiesOf(list.items));
    return list;
  }, [api, gameId, query, activityId]);
  const { state, reload } = useLoad(load, onUnauthenticated);

  return {
    text,
    setText,
    activityId,
    setActivityId,
    activities,
    view: loadViewOf(state),
    reload,
  };
}
