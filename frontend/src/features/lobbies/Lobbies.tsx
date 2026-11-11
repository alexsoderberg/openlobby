import { useState } from "react";
import type { Group } from "../../api";
import { usePopover } from "../../hooks";
import type { PickedStart } from "../../calendar";
import { useMessages } from "../../i18n";
import { ErrorAlert, Icon, Panel, Popover, ViewToggle } from "../../ui";
import { CreateLobby } from "./CreateLobby";
import { LobbyCalendar } from "./LobbyCalendar";
import { LobbyList } from "./LobbyList";
import { useUpcomingLobbies } from "./useUpcomingLobbies";

type LobbyView = "list" | "calendar";

/**
 * The lobby sections of a group page: the upcoming lobbies as a list or a week calendar, and the popover
 * form that adds one, opened by the Create lobby button or from a time of the calendar. The list is the first
 * view of every visit, because the choice is not saved (REQ-0004).
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
  const [initialStart, setInitialStart] = useState<PickedStart>();
  const [created, setCreated] = useState(false);
  const upcoming = useUpcomingLobbies(groupId, onUnauthenticated);
  const popover = usePopover();

  const openForm = (start: PickedStart | undefined, button: HTMLElement) => {
    setInitialStart(start);
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
            onClick={(event) => openForm(undefined, event.currentTarget)}
          >
            <Icon name="plus" />
            {m.lobbyCreateButton}
          </button>
        </div>
        <p role="status" className="status">
          {created && m.lobbyCreated}
        </p>
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
          onChange={setView}
        />
        <LobbyViews
          groupId={groupId}
          members={members}
          view={view}
          upcoming={upcoming}
          onCreate={openForm}
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
            initialStart={initialStart}
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
  onCreate,
}: {
  groupId: string;
  members: Group["members"];
  view: LobbyView;
  upcoming: ReturnType<typeof useUpcomingLobbies>;
  onCreate: (start: PickedStart, button: HTMLElement) => void;
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
      onCreate={onCreate}
    />
  );
}
