import { useEffect, useRef } from "react";
import type { Group } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert, Button, Icon, showToast } from "../../ui";
import { CreateInviteLinkForm } from "./CreateInviteLinkForm";
import { InviteLinkList } from "./InviteLinkList";
import { useCopyInviteLink } from "./useCopyInviteLink";
import { useInviteLinkChanges } from "./useInviteLinkChanges";
import { useInviteLinks } from "./useInviteLinks";

/**
 * The body of the invite popover. A done change or copy is confirmed by a toast (REQ-0022). A change takes its
 * button off the page or disables it, so focus moves to the heading. A failed copy stays in its status region,
 * which stays in the page, so screen readers announce each message.
 */
export function InviteLinks({
  groupId,
  groupName,
  members,
  onUnauthenticated,
  onClose,
}: {
  groupId: string;
  groupName: string;
  members: Group["members"];
  onUnauthenticated: () => void;
  onClose: () => void;
}) {
  const m = useMessages();
  const { state, reload } = useInviteLinks(groupId, onUnauthenticated);
  const {
    state: change,
    create,
    revoke,
  } = useInviteLinkChanges(groupId, reload, onUnauthenticated);
  const { result: copy, copy: copyLink } = useCopyInviteLink();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const saving = change.status === "saving";

  useEffect(() => {
    if (change.status !== "done") return;
    headingRef.current?.focus();
    showToast(
      change.change === "created" ? m.inviteLinkCreated : m.inviteLinkRevoked,
    );
  }, [change, m]);

  useEffect(() => {
    if (copy?.outcome === "copied") showToast(m.inviteLinkCopied);
  }, [copy, m]);

  return (
    <>
      <h2 ref={headingRef} tabIndex={-1}>
        {m.inviteHeading(groupName)}
      </h2>
      <CreateInviteLinkForm busy={saving} onSubmit={create} />
      {change.status === "failed" && (
        <Alert>{toUserMessage(change.code)}</Alert>
      )}
      <InviteLinkList
        state={state}
        members={members}
        busy={saving}
        onRetry={reload}
        onCopy={copyLink}
        onRevoke={revoke}
      />
      <p role="status" className="status">
        {copy?.outcome === "failed" && (
          <span key={copy.attempt} className="status-flash">
            {m.inviteLinkCopyFailed}
          </span>
        )}
      </p>
      <Button type="button" variant="secondary" onClick={onClose}>
        <Icon name="close" />
        {m.inviteClose}
      </Button>
    </>
  );
}
