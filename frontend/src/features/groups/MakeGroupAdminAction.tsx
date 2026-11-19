import { useState } from "react";
import { useMessages } from "../../i18n";
import { Button, Icon } from "../../ui";
import { MakeGroupAdminDialog } from "./MakeGroupAdminDialog";
import { useMakeGroupAdmin } from "./useMakeGroupAdmin";

/** The Make group admin button of one member row, with its confirmation. */
export function MakeGroupAdminAction({
  groupId,
  member,
  onSettled,
  onUnauthenticated,
}: {
  groupId: string;
  member: { userId: string; displayName: string };
  onSettled: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const [confirming, setConfirming] = useState(false);
  const { busy, make } = useMakeGroupAdmin(
    groupId,
    onSettled,
    onUnauthenticated,
  );

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        aria-label={m.makeAdminLabel(member.displayName)}
        onClick={() => setConfirming(true)}
      >
        <Icon name="makeAdmin" />
        {m.makeAdmin}
      </Button>
      {confirming && (
        <MakeGroupAdminDialog
          memberName={member.displayName}
          busy={busy}
          onConfirm={() => make(member.userId)}
          onClose={(made) => {
            setConfirming(false);
            // After the exit: the reload turns the member into an admin and takes this row's button away.
            if (made) onSettled();
          }}
        />
      )}
    </>
  );
}
