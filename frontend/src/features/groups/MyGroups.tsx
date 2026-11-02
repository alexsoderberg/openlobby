import { GroupList } from "./GroupList";
import { useMyGroups } from "./useMyGroups";

export function MyGroups({
  onUnauthenticated,
}: {
  onUnauthenticated: () => void;
}) {
  const { state, reload } = useMyGroups(onUnauthenticated);
  return <GroupList state={state} onRetry={reload} />;
}
