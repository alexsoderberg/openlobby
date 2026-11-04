import type { GroupSummary } from "../../api";
import { CreateGroupForm } from "./CreateGroupForm";
import { useCreateGroup } from "./useCreateGroup";

/** The Create group form with its hook. The caller decides what happens once the group exists. */
export function CreateGroup({
  onCreated,
  onCancel,
  onUnauthenticated,
}: {
  onCreated: (group: GroupSummary) => void;
  onCancel: () => void;
  onUnauthenticated: () => void;
}) {
  const { state, create } = useCreateGroup(onCreated, onUnauthenticated);
  return (
    <CreateGroupForm state={state} onSubmit={create} onCancel={onCancel} />
  );
}
