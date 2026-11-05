import type { ChangeResult } from "../../api";
import { useMessages } from "../../i18n";
import { ConfirmDialog } from "../../ui";

export function LeaveGroupDialog({
  groupName,
  ...rest
}: {
  groupName: string;
  busy: boolean;
  onConfirm: () => ChangeResult;
  onClose: () => void;
}) {
  const m = useMessages();
  return (
    <ConfirmDialog
      heading={m.groupLeaveHeading(groupName)}
      body={m.groupLeaveConfirm}
      submitLabel={m.groupLeaveSubmit}
      keepLabel={m.groupLeaveKeep}
      {...rest}
    />
  );
}
