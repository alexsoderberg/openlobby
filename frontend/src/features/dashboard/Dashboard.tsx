import { useState } from "react";
import type { GroupSummary } from "../../api";
import { useNow } from "../../hooks";
import { useMessages } from "../../i18n";
import { ErrorAlert } from "../../ui";
import { RunningOrder } from "../../runningOrder";
import { GROUPS_PATH, type GroupsState } from "../groups";
import { nextUpOf, thisWeekOf, type DashboardLobby } from "./dashboardLobby";
import { GroupLegend } from "./GroupLegend";
import { NextUpBand } from "./NextUpBand";
import { useDashboardLobbies } from "./useDashboardLobbies";

/** How often the countdown and the Now line are refreshed (ms). They show minutes, so a few seconds of delay do not show. */
const CLOCK_REFRESH_MS = 15_000;

/**
 * The home screen: the Next up band and the running order of This week across all groups. Any failed request gives one page-level
 * error with a retry and no partial data (ADR 0014).
 */
export function Dashboard({
  groups,
  onRetryGroups,
  onUnauthenticated,
}: {
  groups: GroupsState;
  onRetryGroups: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  return (
    <>
      <h1>{m.shell.home}</h1>
      <DashboardBody
        groups={groups}
        onRetryGroups={onRetryGroups}
        onUnauthenticated={onUnauthenticated}
      />
    </>
  );
}

function DashboardBody({
  groups,
  onRetryGroups,
  onUnauthenticated,
}: {
  groups: GroupsState;
  onRetryGroups: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  if (groups.status === "loading")
    return <p role="status">{m.dashboard.loading}</p>;
  if (groups.status === "error")
    return <ErrorAlert code={groups.code} onRetry={onRetryGroups} />;
  if (groups.groups.length === 0)
    return (
      <div className="empty-state">
        <p className="empty-state__title">{m.dashboard.noGroups}</p>
        <p>{m.dashboard.noGroupsHint}</p>
        <a href={GROUPS_PATH}>{m.dashboard.noGroupsLink}</a>
      </div>
    );
  return (
    <DashboardLobbies
      groups={groups.groups}
      onUnauthenticated={onUnauthenticated}
    />
  );
}

function DashboardLobbies({
  groups,
  onUnauthenticated,
}: {
  groups: GroupSummary[];
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const { state, reload, refresh } = useDashboardLobbies(
    groups,
    onUnauthenticated,
  );
  if (state.status === "loading")
    return <p role="status">{m.dashboard.loading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={reload} />;
  return (
    <DashboardContent
      lobbies={state.value}
      onChanged={refresh}
      onUnauthenticated={onUnauthenticated}
    />
  );
}

/** The choice of Next up and the week is made once, at loading. Only the countdown and the Now line keep moving. */
function DashboardContent({
  lobbies,
  onChanged,
  onUnauthenticated,
}: {
  lobbies: DashboardLobby[];
  onChanged: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const now = useNow(CLOCK_REFRESH_MS);
  const [loadedAt] = useState(now);
  const week = thisWeekOf(lobbies, loadedAt);

  return (
    <>
      <NextUpBand
        lobby={nextUpOf(lobbies, loadedAt)}
        now={now}
        onChanged={onChanged}
        onUnauthenticated={onUnauthenticated}
      />
      <RunningOrder
        heading={m.dashboard.thisWeekHeading}
        days={week}
        now={new Date(now)}
      />
      <GroupLegend days={week} />
    </>
  );
}
