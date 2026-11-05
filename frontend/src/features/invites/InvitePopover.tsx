import type { usePopover } from "../../hooks";
import { useMessages } from "../../i18n";
import { ErrorAlert, Popover } from "../../ui";
import { GROUP_NOT_FOUND, useGroup } from "../groups";
import { InviteLinks } from "./InviteLinks";

export type InviteGroup = { id: string; name: string };

/** Loads the members first: the list names each link's creator. */
function InviteContent({
  group,
  onClose,
  onUnauthenticated,
}: {
  group: InviteGroup;
  onClose: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const { state, reload } = useGroup(group.id, onUnauthenticated);
  if (state.status === "loading") return <p role="status">{m.groupLoading}</p>;
  if (state.status !== "loaded")
    return (
      <ErrorAlert
        code={state.status === "error" ? state.code : GROUP_NOT_FOUND}
        onRetry={reload}
      />
    );
  return (
    <InviteLinks
      groupId={group.id}
      groupName={group.name}
      members={state.group.members}
      onUnauthenticated={onUnauthenticated}
      onClose={onClose}
    />
  );
}

/** The invite popover of one group. The caller owns the open state (usePopover) and says which group. */
export function InvitePopover({
  group,
  popover,
  onUnauthenticated,
}: {
  group: InviteGroup | undefined;
  popover: ReturnType<typeof usePopover>;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  return (
    <Popover
      centered
      label={group ? m.inviteHeading(group.name) : m.inviteButton}
      open={popover.open}
      origin={popover.origin}
      frameRef={popover.popoverRef}
      onClose={popover.close}
    >
      {popover.opening > 0 && group && (
        <InviteContent
          key={`${popover.opening}-${group.id}`}
          group={group}
          onClose={popover.close}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </Popover>
  );
}
