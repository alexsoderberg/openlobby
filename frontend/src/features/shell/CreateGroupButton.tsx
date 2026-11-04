import { useMessages } from "../../i18n";

/** The "+" in the Group rail and the Tab bar. It turns into "×" while the Create group form is open. */
export function CreateGroupButton({
  open,
  onPress,
}: {
  open: boolean;
  onPress: (button: HTMLElement) => void;
}) {
  const m = useMessages();
  return (
    <button
      type="button"
      className="plus-button"
      aria-label={m.shell.createGroupButton}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(event) => onPress(event.currentTarget)}
    >
      <span className="plus-button__icon" aria-hidden="true" />
    </button>
  );
}
