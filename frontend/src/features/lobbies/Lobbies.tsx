import { useState } from "react";
import type { Group } from "../../api";
import { useMessages } from "../../i18n";
import { ErrorAlert, Panel } from "../../ui";
import { CreateLobby } from "./CreateLobby";
import { LobbyCalendar } from "./LobbyCalendar";
import { LobbyList } from "./LobbyList";
import { LobbyViewSwitch, type LobbyView } from "./LobbyViewSwitch";
import { useUpcomingLobbies } from "./useUpcomingLobbies";

/**
 * The lobby sections of a group page: the upcoming lobbies as a list or a week calendar, and the form
 * that adds one. The list is the first view of every visit, because the choice is not saved (REQ-0004).
 */
export function Lobbies({
  groupId,
  members,
  onUnauthenticated,
}: {
  groupId: string;
  members: Group["members"];
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const [view, setView] = useState<LobbyView>("list");
  const upcoming = useUpcomingLobbies(groupId, onUnauthenticated);

  return (
    <>
      <Panel>
        <h2>{m.lobbiesHeading}</h2>
        <LobbyViewSwitch view={view} onChange={setView} />
        <LobbyViews
          groupId={groupId}
          members={members}
          view={view}
          upcoming={upcoming}
        />
      </Panel>
      <CreateLobby
        groupId={groupId}
        onCreated={upcoming.refresh}
        onUnauthenticated={onUnauthenticated}
      />
    </>
  );
}

/** Loading, error, empty (the same text in both views) or the chosen view. */
function LobbyViews({
  groupId,
  members,
  view,
  upcoming: { state, reload },
}: {
  groupId: string;
  members: Group["members"];
  view: LobbyView;
  upcoming: ReturnType<typeof useUpcomingLobbies>;
}) {
  const m = useMessages();
  if (state.status === "loading")
    return <p role="status">{m.lobbiesLoading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={reload} />;
  if (state.value.length === 0) return <p>{m.lobbiesEmpty}</p>;
  return view === "list" ? (
    <LobbyList groupId={groupId} lobbies={state.value} members={members} />
  ) : (
    <LobbyCalendar groupId={groupId} lobbies={state.value} />
  );
}
