import type { GroupSummary } from "../../api";
import { useMessages } from "../../i18n";
import { GroupIcon } from "../../ui";
import { groupPath } from "../groups";

/** Phones: a swipeable row of group icons at the top of the dashboard. Wide screens use the Group rail instead. */
export function GroupStrip({ groups }: { groups: GroupSummary[] }) {
  const m = useMessages();
  return (
    <nav className="group-strip" aria-label={m.dashboard.groupStripLabel}>
      <ul className="row-list" role="list">
        {groups.map((group) => (
          <li key={group.id}>
            <GroupIcon
              name={group.name}
              href={groupPath(group.id)}
              active={false}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
