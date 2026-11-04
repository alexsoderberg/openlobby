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
  const { state, reload, refresh } = useUpcomingLobbies(
    groupId,
    onUnauthenticated,
  );

  return (
    <>
      <Panel>
        <h2>{m.lobbiesHeading}</h2>
        <LobbyViewSwitch view={view} onChange={setView} />
        {state.status === "loading" && <p role="status">{m.lobbiesLoading}</p>}
        {state.status === "error" && (
          <ErrorAlert code={state.code} onRetry={reload} />
        )}
        {state.status === "loaded" &&
          (state.value.length === 0 ? (
            <p>{m.lobbiesEmpty}</p>
          ) : view === "list" ? (
            <LobbyList
              groupId={groupId}
              lobbies={state.value}
              members={members}
            />
          ) : (
            <LobbyCalendar groupId={groupId} lobbies={state.value} />
          ))}
      </Panel>
      <CreateLobby
        groupId={groupId}
        onCreated={refresh}
        onUnauthenticated={onUnauthenticated}
      />
    </>
  );
}
