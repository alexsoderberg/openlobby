import { groupColorIndex } from "../../groupColor";
import { useMessages } from "../../i18n";
import type { RunningOrderLobby, WeekDay } from "../../runningOrder";

/** The groups that have a block this week, in the order of their first block. */
function groupsOf(days: WeekDay<RunningOrderLobby>[]) {
  const names = new Map<string, string>();
  for (const { groupId, groupName } of days.flatMap(({ items }) => items))
    if (!names.has(groupId)) names.set(groupId, groupName);
  return [...names];
}

/**
 * The key below the running order on Home: each group's colour swatch and name, and the outline of a lobby I am in
 * (ADR 0028 sections 4 and 16.7). Nothing when the week has no block.
 */
export function GroupLegend({ days }: { days: WeekDay<RunningOrderLobby>[] }) {
  const m = useMessages();
  const groups = groupsOf(days);
  if (groups.length === 0) return null;
  return (
    <ul className="group-legend" aria-label={m.dashboard.legendLabel}>
      {groups.map(([groupId, groupName]) => (
        <li key={groupId}>
          <span
            className="group-legend__swatch"
            data-group-color={groupColorIndex(groupId)}
          />
          {groupName}
        </li>
      ))}
      <li>
        <span className="group-legend__swatch" data-mine />
        {m.dashboard.legendYou}
      </li>
    </ul>
  );
}
