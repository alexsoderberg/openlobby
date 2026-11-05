import { useState } from "react";
import { useMessages } from "../../i18n";
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

  async function confirmMake() {
    const code = await make(member.userId);
    if (code === undefined) setConfirming(false);
    return code;
  }

  return (
    <>
      <button
        type="button"
        className="button button--secondary"
        aria-label={m.makeAdminLabel(member.displayName)}
        onClick={() => setConfirming(true)}
      >
        {m.makeAdmin}
      </button>
      {confirming && (
        <MakeGroupAdminDialog
          memberName={member.displayName}
          busy={busy}
          onConfirm={confirmMake}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
