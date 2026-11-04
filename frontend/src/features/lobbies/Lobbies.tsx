import { useState } from "react";
import type { Group } from "../../api";
import { usePopover } from "../../hooks";
import { useMessages } from "../../i18n";
import { ErrorAlert, Panel, Popover } from "../../ui";
import { CreateLobby } from "./CreateLobby";
import { LobbyCalendar } from "./LobbyCalendar";
import { LobbyList } from "./LobbyList";
import { LobbyViewSwitch, type LobbyView } from "./LobbyViewSwitch";
import { useUpcomingLobbies } from "./useUpcomingLobbies";

/**
 * The lobby sections of a group page: the upcoming lobbies as a list or a week calendar, and the popover
 * form that adds one, opened by the Create lobby button or from a day of the calendar. The list is the first view of every visit, because the choice is not saved (REQ-0004).
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
  const [initialDate, setInitialDate] = useState<Date>();
  const [created, setCreated] = useState(false);
  const upcoming = useUpcomingLobbies(groupId, onUnauthenticated);
  const popover = usePopover();

  const openForm = (button: HTMLElement, date?: Date) => {
    setInitialDate(date);
    setCreated(false);
    popover.press(button);
  };
  const handleCreated = () => {
    upcoming.refresh();
    setCreated(true);
    popover.close();
  };

  return (
    <>
      <Panel>
        <div className="panel__head">
          <h2>{m.lobbiesHeading}</h2>
          <button
            type="button"
            className="button"
            aria-haspopup="dialog"
            aria-expanded={popover.open}
            onClick={(event) => openForm(event.currentTarget)}
          >
            {m.lobbyCreateButton}
          </button>
        </div>
        <p role="status" className="status">
          {created && m.lobbyCreated}
        </p>
        <LobbyViewSwitch view={view} onChange={setView} />
        <LobbyViews
          groupId={groupId}
          members={members}
          view={view}
          upcoming={upcoming}
          onCreateOn={openForm}
        />
      </Panel>
      <Popover
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
            initialDate={initialDate}
            onCreated={handleCreated}
            onCancel={popover.close}
            onUnauthenticated={onUnauthenticated}
          />
        )}
      </Popover>
    </>
  );
}

/** Loading, error, empty (the same text in both views) or the chosen view. */
function LobbyViews({
  groupId,
  members,
  view,
  upcoming: { state, reload },
  onCreateOn,
}: {
  groupId: string;
  members: Group["members"];
  view: LobbyView;
  upcoming: ReturnType<typeof useUpcomingLobbies>;
  onCreateOn: (button: HTMLElement, day: Date) => void;
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
      lobbies={state.value}
      onCreate={(day, button) => onCreateOn(button, day)}
    />
  );
}
