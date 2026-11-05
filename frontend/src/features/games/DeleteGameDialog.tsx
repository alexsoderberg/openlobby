import type { ChangeResult, Game } from "../../api";
import { useMessages } from "../../i18n";
import { ConfirmDialog } from "../../ui";

export function DeleteGameDialog({
  game,
  ...rest
}: {
  game: Game;
  busy: boolean;
  onConfirm: () => ChangeResult;
  onClose: () => void;
}) {
  const m = useMessages();
  return (
    <ConfirmDialog
      heading={m.gameRemoveHeading(game.name)}
      body={m.gameRemoveConfirm}
      submitLabel={m.gameRemoveSubmit}
      keepLabel={m.gameRemoveKeep}
      {...rest}
    />
  );
}
