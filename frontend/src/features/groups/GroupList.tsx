import { useMessages } from "../../i18n";
import { ErrorAlert } from "../../ui/ErrorAlert";
import type { GroupsState } from "./useMyGroups";

export function GroupList({
  state,
  onRetry,
}: {
  state: GroupsState;
  onRetry: () => void;
}) {
  const m = useMessages();

  if (state.status === "loading") return <p role="status">{m.groupsLoading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={onRetry} />;
  if (state.groups.length === 0) return <p>{m.groupsEmpty}</p>;

  return (
    <ul className="group-list">
      {state.groups.map((group) => (
        <li key={group.id}>{group.name}</li>
      ))}
    </ul>
  );
}
