import { useState } from "react";
import { useMessages } from "../../i18n";
import { thisWeekOf, type DashboardLobby } from "./dashboardLobby";
import { DayAgenda } from "./DayAgenda";
import { DayPills } from "./DayPills";
import { WeekGrid } from "./WeekGrid";

/**
 * The current week across all groups: a grid on wide screens, Day pills with an Agenda on phones.
 * Which one shows is decided by CSS, so the width is known in one place. `now` is the time of loading.
 */
export function ThisWeek({
  lobbies,
  now,
}: {
  lobbies: DashboardLobby[];
  now: number;
}) {
  const m = useMessages();
  const days = thisWeekOf(lobbies, now);
  const todayIndex = days.findIndex(
    ({ day }) => day.toDateString() === new Date(now).toDateString(),
  );
  const [selected, setSelected] = useState(todayIndex);

  return (
    <section aria-labelledby="this-week-heading">
      <h2 id="this-week-heading">{m.dashboard.thisWeekHeading}</h2>
      <div className="week-wide">
        <WeekGrid days={days} todayIndex={todayIndex} />
      </div>
      <div className="week-narrow">
        <DayPills
          days={days}
          selected={selected}
          todayIndex={todayIndex}
          onSelect={setSelected}
        />
        <DayAgenda lobbies={days[selected].items} />
      </div>
    </section>
  );
}
