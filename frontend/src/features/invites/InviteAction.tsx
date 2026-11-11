import { usePopover } from "../../hooks";
import { useMessages } from "../../i18n";
import { Icon } from "../../ui";
import { InvitePopover, type InviteGroup } from "./InvitePopover";

/** The Invite button of a Group view, with its popover. The keyboard and screen-reader route to invites. */
export function InviteAction({
  group,
  onUnauthenticated,
}: {
  group: InviteGroup;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const popover = usePopover();
  return (
    <>
      <button
        type="button"
        className="button button--secondary"
        aria-haspopup="dialog"
        aria-expanded={popover.open}
        onClick={(event) => popover.press(event.currentTarget)}
      >
        <Icon name="invite" />
        {m.inviteButton}
      </button>
      <InvitePopover
        group={group}
        popover={popover}
        onUnauthenticated={onUnauthenticated}
      />
    </>
  );
}
