import { useState } from "react";
import { useMessages } from "../../i18n";
import { Button, Icon } from "../../ui";
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

  return (
    <>
      <Button
        type="button"
        variant="danger"
        onClick={() => setConfirming(true)}
      >
        <Icon name="leave" />
        {m.groupLeave}
      </Button>
      {confirming && (
        <LeaveGroupDialog
          groupName={group.name}
          busy={busy}
          onConfirm={leave}
          onClose={(left) => {
            setConfirming(false);
            if (left) onLeft(group);
          }}
        />
      )}
    </>
  );
}
