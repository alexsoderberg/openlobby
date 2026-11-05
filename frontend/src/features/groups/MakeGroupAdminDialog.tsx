import type { ChangeResult } from "../../api";
import { useMessages } from "../../i18n";
import { ConfirmDialog } from "../../ui";

export function MakeGroupAdminDialog({
  memberName,
  ...rest
}: {
  memberName: string;
  busy: boolean;
  onConfirm: () => ChangeResult;
  onClose: () => void;
}) {
  const m = useMessages();
  return (
    <ConfirmDialog
      heading={m.makeAdminHeading(memberName)}
      body={m.makeAdminConfirm}
      submitLabel={m.makeAdminSubmit}
      keepLabel={m.makeAdminKeep}
      {...rest}
    />
  );
}
