import { CreateGroupForm } from "./CreateGroupForm";
import { GroupList } from "./GroupList";
import { useCreateGroup } from "./useCreateGroup";
import { useMyGroups } from "./useMyGroups";

export function MyGroups({
  onUnauthenticated,
}: {
  onUnauthenticated: () => void;
}) {
  const { state, reload } = useMyGroups(onUnauthenticated);
  const { state: createState, create } = useCreateGroup(
    reload,
    onUnauthenticated,
  );
  return (
    <>
      <GroupList state={state} onRetry={reload} />
      <CreateGroupForm state={createState} onSubmit={create} />
    </>
  );
}
