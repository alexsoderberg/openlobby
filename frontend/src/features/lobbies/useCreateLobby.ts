import { useState } from "react";
import { useApi, type ChangeResult, type CreateLobbyInput } from "../../api";
import { useLobbyAction } from "./useLobbyAction";

/**
 * Saves a lobby. `create` resolves to the error code of a failure, or undefined on success, after
 * `onCreated` has run. `created` is true after a save and false again while the next one runs.
 */
export function useCreateLobby(
  groupId: string,
  onCreated: () => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const { busy, run } = useLobbyAction(onUnauthenticated);
  const [created, setCreated] = useState(false);

  async function create(input: CreateLobbyInput): ChangeResult {
    setCreated(false);
    const code = await run(() => api.createLobby(groupId, input));
    if (code !== undefined) return code;
    setCreated(true);
    onCreated();
    return undefined;
  }

  return { busy, created, create };
}
