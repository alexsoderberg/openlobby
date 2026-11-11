import { useEffect, useRef } from "react";
import { useMessages } from "../../i18n";
import { Icon } from "../../ui";

export type MenuPosition = { x: number; y: number };

const ESCAPE = "Escape";
const TAB = "Tab";
const MOVE_KEYS = ["ArrowUp", "ArrowDown", "Home", "End"];

/**
 * The right-click menu of a group icon. It has one item, so the arrow keys only keep focus on it. Esc, Tab
 * and a press outside close it; the caller returns focus to the icon.
 */
export function GroupContextMenu({
  groupName,
  position,
  onInvite,
  onClose,
}: {
  groupName: string;
  position: MenuPosition;
  onInvite: () => void;
  onClose: () => void;
}) {
  const m = useMessages();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      aria-label={m.shell.groupMenu(groupName)}
      style={{ left: position.x, top: position.y }}
      onKeyDown={(event) => {
        if (event.key === ESCAPE || event.key === TAB) onClose();
        if (MOVE_KEYS.includes(event.key)) event.preventDefault();
      }}
    >
      <button
        type="button"
        role="menuitem"
        className="context-menu__item"
        onClick={onInvite}
      >
        <Icon name="invite" />
        {m.shell.invitePeople}
      </button>
    </div>
  );
}
