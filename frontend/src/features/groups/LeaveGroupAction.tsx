import { useState } from "react";
import { useMessages } from "../../i18n";
import { Icon } from "../../ui";
import { LeaveGroupDialog } from "./LeaveGroupDialog";
import { useLeaveGroup } from "./useLeaveGroup";

/** The Leave group button of a Group view, with its confirmation. After a success the owner leaves the page. */
export function LeaveGroupAction({
  group,
  onLeft,
  onUnauthenticated,
}: {
  group: { id: string; name: string };
  onLeft: (group: { id: string; name: string }) => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const [confirming, setConfirming] = useState(false);
  const { busy, leave } = useLeaveGroup(group.id, onUnauthenticated);

  async function confirmLeave() {
    const code = await leave();
    if (code === undefined) onLeft(group);
    return code;
  }

  return (
    <>
      <button
        type="button"
        className="button button--danger"
        onClick={() => setConfirming(true)}
      >
        <Icon name="leave" />
        {m.groupLeave}
      </button>
      {confirming && (
        <LeaveGroupDialog
          groupName={group.name}
          busy={busy}
          onConfirm={confirmLeave}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
