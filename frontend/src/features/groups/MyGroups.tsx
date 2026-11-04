import { Panel } from "../../ui";
import { GroupList } from "./GroupList";
import type { GroupsState } from "./useMyGroups";

/** The Group list page. Groups are created from the "+" in the app shell. */
export function MyGroups({
  state,
  onRetry,
}: {
  state: GroupsState;
  onRetry: () => void;
}) {
  return (
    <Panel>
      <GroupList state={state} onRetry={onRetry} />
    </Panel>
  );
}
