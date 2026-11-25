import { useState } from "react";
import {
  useApi,
  type ChangeResult,
  type Game,
  type GameImageKind,
} from "../../api";
import { useChangeAction } from "../../hooks";

export type GameImageStatus =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" | "removed" }
  | { status: "failed"; code: string };

/** The `Game` field that holds the version of each kind. */
const VERSION_FIELD = {
  logo: "logoVersion",
} as const satisfies Record<GameImageKind, keyof Game>;

/**
 * Uploads and removes one image of a game, each on its own request (ADR 0026). Keeps the version the server
 * answered, so the field shows the new image at once, and calls `onChanged` so the list loads it too.
 */
export function useGameImage(
  game: Game,
  kind: GameImageKind,
  onChanged: () => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const { busy, run } = useChangeAction(onUnauthenticated);
  const listed = game[VERSION_FIELD[kind]] ?? null;
  const [version, setVersion] = useState(listed);
  // A reloaded list is newer than the last answer, so it wins (React's "adjust state when a prop changes").
  const [lastListed, setLastListed] = useState(listed);
  if (listed !== lastListed) {
    setLastListed(listed);
    setVersion(listed);
  }
  const [state, setState] = useState<GameImageStatus>({ status: "idle" });

  async function upload(image: Blob) {
    setState({ status: "saving" });
    const code = await run(async () => {
      const saved = await api.setGameImage(game.id, kind, image);
      setVersion(saved[VERSION_FIELD[kind]] ?? null);
    });
    if (code !== undefined) return setState({ status: "failed", code });
    setState({ status: "saved" });
    onChanged();
  }

  async function remove(): ChangeResult {
    const code = await run(() => api.removeGameImage(game.id, kind));
    if (code !== undefined) return code;
    setVersion(null);
    setState({ status: "removed" });
    onChanged();
    return undefined;
  }

  return { version, state, busy, upload, remove };
}
