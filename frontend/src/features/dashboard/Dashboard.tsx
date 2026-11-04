import { useState } from "react";
import type { GroupSummary } from "../../api";
import { useNow } from "../../hooks";
import { useMessages } from "../../i18n";
import { ErrorAlert } from "../../ui";
import { GROUPS_PATH, type GroupsState } from "../groups";
import { nextUpOf, type DashboardLobby } from "./dashboardLobby";
import { GroupStrip } from "./GroupStrip";
import { NextUpCard } from "./NextUpCard";
import { ThisWeek } from "./ThisWeek";
import { useDashboardLobbies } from "./useDashboardLobbies";

/** How often the countdown is refreshed (ms). It shows minutes, so a few seconds of delay do not show. */
const COUNTDOWN_REFRESH_MS = 15_000;

/**
 * The home screen: Next up and This week across all groups. Any failed request gives one page-level
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
      <h1>{m.dashboard.heading}</h1>
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
    <>
      <GroupStrip groups={groups.groups} />
      <DashboardLobbies
        groups={groups.groups}
        onUnauthenticated={onUnauthenticated}
      />
    </>
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
  const { state, reload } = useDashboardLobbies(groups, onUnauthenticated);
  if (state.status === "loading")
    return <p role="status">{m.dashboard.loading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={reload} />;
  return <DashboardContent lobbies={state.value} />;
}

/** The choice of Next up and the week is made once, at loading. Only the card's countdown keeps moving. */
function DashboardContent({ lobbies }: { lobbies: DashboardLobby[] }) {
  const m = useMessages();
  const now = useNow(COUNTDOWN_REFRESH_MS);
  const [loadedAt] = useState(now);
  const nextUp = nextUpOf(lobbies, loadedAt);

  return (
    <>
      <section aria-labelledby="next-up-heading">
        <h2 id="next-up-heading">{m.dashboard.nextUpHeading}</h2>
        {nextUp ? (
          <NextUpCard lobby={nextUp} now={now} />
        ) : (
          <p className="empty-state__title">{m.dashboard.nothingBooked}</p>
        )}
      </section>
      <ThisWeek lobbies={lobbies} now={loadedAt} />
    </>
  );
}
