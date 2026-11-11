import {
  useCallback,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { GroupSummary } from "../../api";
import { useMessages } from "../../i18n";
import { GroupIcon, Icon } from "../../ui";
import { groupPath } from "../groups";
import { HOME_PATH, type ActiveNav } from "./activeNav";
import { CreateGroupButton } from "./CreateGroupButton";
import { GroupContextMenu, type MenuPosition } from "./GroupContextMenu";

type OpenMenu = {
  group: GroupSummary;
  icon: HTMLElement;
  position: MenuPosition;
};

const F10 = "F10";
const CONTEXT_MENU_KEY = "ContextMenu";

/** Shift+F10 and the Context Menu key open the menu next to the focused icon, as a right-click would at the pointer. */
function isMenuKey(event: KeyboardEvent) {
  return (
    event.key === CONTEXT_MENU_KEY || (event.shiftKey && event.key === F10)
  );
}

/**
 * Wide screens: Home, one icon per group, and the "+" at the bottom. A failed group list leaves only Home
 * and "+"; the page shows the error.
 */
export function GroupRail({
  groups,
  active,
  onCreate,
  createOpen,
  onInvite,
}: {
  groups: GroupSummary[];
  active: ActiveNav;
  /** Without it there is no "+". */
  onCreate?: (button: HTMLElement) => void;
  createOpen: boolean;
  /** Opens the invite popover of a group; `icon` is where focus returns. */
  onInvite: (group: GroupSummary, icon: HTMLElement) => void;
}) {
  const m = useMessages();
  const [menu, setMenu] = useState<OpenMenu>();
  const openMenu = (
    group: GroupSummary,
    item: HTMLElement,
    position: MenuPosition,
  ) => {
    const icon = item.querySelector<HTMLElement>("a") ?? item;
    setMenu({ group, icon, position });
  };
  // Stable while the menu is open, so the menu's focus and outside-click effect runs once.
  const closeMenu = useCallback(() => {
    menu?.icon.focus();
    setMenu(undefined);
  }, [menu]);
  const onContextMenu = (
    group: GroupSummary,
    event: MouseEvent<HTMLElement>,
  ) => {
    event.preventDefault();
    openMenu(group, event.currentTarget, {
      x: event.clientX,
      y: event.clientY,
    });
  };
  const onKeyDown = (
    group: GroupSummary,
    event: KeyboardEvent<HTMLElement>,
  ) => {
    if (!isMenuKey(event)) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    openMenu(group, event.currentTarget, { x: box.right, y: box.top });
  };
  return (
    <nav className="group-rail" aria-label={m.shell.groupsNav}>
      <a
        className="group-icon"
        href={HOME_PATH}
        aria-label={m.shell.home}
        title={m.shell.home}
        aria-current={active.section === "home" ? "page" : undefined}
      >
        <Icon name="home" className="nav-icon" />
      </a>
      <span className="group-rail__separator" aria-hidden="true" />
      <ul className="row-list group-rail__groups" role="list">
        {groups.map((group) => (
          <li
            key={group.id}
            onContextMenu={(event) => onContextMenu(group, event)}
            onKeyDown={(event) => onKeyDown(group, event)}
          >
            <GroupIcon
              name={group.name}
              href={groupPath(group.id)}
              active={active.groupId === group.id}
            />
          </li>
        ))}
      </ul>
      {menu && (
        <GroupContextMenu
          groupName={menu.group.name}
          position={menu.position}
          onClose={closeMenu}
          onInvite={() => {
            setMenu(undefined);
            onInvite(menu.group, menu.icon);
          }}
        />
      )}
      {onCreate && <CreateGroupButton open={createOpen} onPress={onCreate} />}
    </nav>
  );
}
