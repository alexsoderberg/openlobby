import { useCallback, useState } from "react";
import { errorCodeOf, isUnauthenticated, useApi } from "../../api";
import { INVALID_GROUP_NAME } from "./groupErrors";
import { isValidGroupName } from "./groupName";

export type CreateGroupState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "created" }
  | { status: "failed"; code: string };

/** Creates a group. A name that fails the local check never reaches the server. */
export function useCreateGroup(
  onCreated: () => void,
  onUnauthenticated: () => void,
) {
  const api = useApi();
  const [state, setState] = useState<CreateGroupState>({ status: "idle" });

  const create = useCallback(
    async (name: string) => {
      if (!isValidGroupName(name)) {
        setState({ status: "failed", code: INVALID_GROUP_NAME });
        return;
      }
      setState({ status: "saving" });
      try {
        await api.createGroup(name);
        setState({ status: "created" });
        onCreated();
      } catch (error) {
        if (isUnauthenticated(error)) onUnauthenticated();
        else setState({ status: "failed", code: errorCodeOf(error) });
      }
    },
    [api, onCreated, onUnauthenticated],
  );

  return { state, create };
}
