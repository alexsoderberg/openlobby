import { useMessages } from "../../i18n";
import { Icon } from "../../ui";

/** The "+" in the Group rail and the floating one on phones (`className` marks that one). It turns into "×" while the Create group form is open. */
export function CreateGroupButton({
  open,
  onPress,
  className = "plus-button",
}: {
  open: boolean;
  className?: string;
  onPress: (button: HTMLElement) => void;
}) {
  const m = useMessages();
  return (
    <button
      type="button"
      className={className}
      aria-label={m.shell.createGroupButton}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={(event) => onPress(event.currentTarget)}
    >
      <Icon name="plus" className="plus-button__icon" />
    </button>
  );
}
