import { useCallback, useState } from "react";
import type { Group, Lobby } from "../../api";
import { usePopover } from "../../hooks";
import { useMessages } from "../../i18n";
import type { CreateOn } from "../../runningOrder";
import {
  Button,
  CreateFrame,
  ErrorAlert,
  Icon,
  Panel,
  ViewToggle,
} from "../../ui";
import { CreateLobby } from "./CreateLobby";
import { LobbyCalendar } from "./LobbyCalendar";
import { LobbyList } from "./LobbyList";
import { useUpcomingLobbies } from "./useUpcomingLobbies";

type LobbyView = "list" | "calendar";

/**
 * The lobby sections of a group page: the upcoming lobbies as a list or a week calendar, and the popover
 * form that adds one, opened by the Create lobby button or from a day of the calendar. The list is the first
 * view of every visit, because the choice is not saved (REQ-0004). A lobby created in the list view is always in
 * the list, so only the calendar may confirm it with a toast (REQ-0022).
 */
export function Lobbies({
  groupId,
  groupName,
  members,
  onUnauthenticated,
}: {
  groupId: string;
  groupName: string;
  members: Group["members"];
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const [view, setView] = useState<LobbyView>("list");
  const [initialStart, setInitialStart] = useState<Date>();
  const [createdId, setCreatedId] = useState<string>();
  const upcoming = useUpcomingLobbies(groupId, onUnauthenticated);
  const popover = usePopover();

  const openForm = (start: Date | undefined, button: HTMLElement) => {
    setInitialStart(start);
    popover.press(button);
  };
  const handleCreated = (lobby: Lobby) => {
    upcoming.refresh();
    if (view === "calendar") setCreatedId(lobby.id);
    popover.close();
  };
  const clearCreated = useCallback(() => setCreatedId(undefined), []);
  // A failed reload shows the error, not the lobby: no later reload may confirm it.
  if (createdId !== undefined && upcoming.state.status === "error")
    setCreatedId(undefined);
  const changeView = (next: LobbyView) => {
    clearCreated();
    setView(next);
  };

  return (
    <>
      <Panel>
        <div className="heading-row">
          <div className="panel__head">
            <h2>{m.lobbiesHeading}</h2>
            <Button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={popover.open}
              onClick={(event) => openForm(undefined, event.currentTarget)}
            >
              <Icon name="plus" />
              {m.lobbyCreateButton}
            </Button>
          </div>
          <ViewToggle
            label={m.lobbyViewLabel}
            value={view}
            options={[
              { value: "list", label: m.lobbyViewList, icon: "list" },
              {
                value: "calendar",
                label: m.lobbyViewCalendar,
                icon: "calendar",
              },
            ]}
            onChange={changeView}
          />
        </div>
        <LobbyViews
          groupId={groupId}
          groupName={groupName}
          members={members}
          view={view}
          upcoming={upcoming}
          createdId={createdId}
          onCreatedSettled={clearCreated}
          onCreate={openForm}
        />
      </Panel>
      <CreateFrame
        centered
        closeOnScrim={false}
        label={m.lobbyCreateHeading}
        open={popover.open}
        origin={popover.origin}
        frameRef={popover.popoverRef}
        onClose={popover.close}
      >
        {popover.opening > 0 && (
          <CreateLobby
            key={popover.opening}
            groupId={groupId}
            initialStart={initialStart}
            onCreated={handleCreated}
            onCancel={popover.close}
            onUnauthenticated={onUnauthenticated}
          />
        )}
      </CreateFrame>
    </>
  );
}

/** Loading, error, empty (the same text in both views) or the chosen view. */
function LobbyViews({
  groupId,
  groupName,
  members,
  view,
  upcoming: { state, reload },
  createdId,
  onCreatedSettled,
  onCreate,
}: {
  groupId: string;
  groupName: string;
  members: Group["members"];
  view: LobbyView;
  upcoming: ReturnType<typeof useUpcomingLobbies>;
  createdId?: string;
  onCreatedSettled: () => void;
  onCreate: CreateOn;
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
    <LobbyCalendar
      groupId={groupId}
      groupName={groupName}
      lobbies={state.value}
      createdId={createdId}
      onCreatedSettled={onCreatedSettled}
      onCreate={onCreate}
    />
  );
}
