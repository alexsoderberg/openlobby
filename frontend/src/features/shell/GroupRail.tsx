import type { GroupSummary } from "../../api";
import { useMessages } from "../../i18n";
import { GroupIcon } from "../../ui";
import { groupPath } from "../groups";
import { HOME_PATH, type ActiveNav } from "./activeNav";
import { CreateGroupButton } from "./CreateGroupButton";
import { HomeIcon } from "./icons";

/**
 * Wide screens: Home, one icon per group, and the "+" at the bottom. A failed group list leaves only Home
 * and "+"; the page shows the error.
 */
export function GroupRail({
  groups,
  active,
  onCreate,
  createOpen,
}: {
  groups: GroupSummary[];
  active: ActiveNav;
  /** Without it there is no "+". */
  onCreate?: (button: HTMLElement) => void;
  createOpen: boolean;
}) {
  const m = useMessages();
  return (
    <nav className="group-rail" aria-label={m.shell.groupsNav}>
      <a
        className="group-icon"
        href={HOME_PATH}
        aria-label={m.shell.home}
        title={m.shell.home}
        aria-current={active.section === "home" ? "page" : undefined}
      >
        <HomeIcon />
      </a>
      <span className="group-rail__separator" aria-hidden="true" />
      <ul className="row-list group-rail__groups" role="list">
        {groups.map((group) => (
          <li key={group.id}>
            <GroupIcon
              name={group.name}
              href={groupPath(group.id)}
              active={active.groupId === group.id}
            />
          </li>
        ))}
      </ul>
      {onCreate && <CreateGroupButton open={createOpen} onPress={onCreate} />}
    </nav>
  );
}
