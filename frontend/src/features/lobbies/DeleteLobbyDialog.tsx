import type { ChangeResult } from "../../api";
import { useMessages } from "../../i18n";
import { ConfirmDialog } from "../../ui";

export function DeleteLobbyDialog({
  label,
  ...rest
}: {
  label: string;
  busy: boolean;
  onConfirm: () => ChangeResult;
  onClose: () => void;
}) {
  const m = useMessages();
  return (
    <ConfirmDialog
      heading={m.lobbyDeleteHeading(label)}
      body={m.lobbyDeleteConfirm}
      submitLabel={m.lobbyDeleteSubmit}
      keepLabel={m.lobbyDeleteKeep}
      {...rest}
    />
  );
}
