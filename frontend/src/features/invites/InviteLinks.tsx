import { useEffect, useRef } from "react";
import type { Group } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui";
import { CreateInviteLinkForm } from "./CreateInviteLinkForm";
import { InviteLinkList } from "./InviteLinkList";
import { useCopyInviteLink } from "./useCopyInviteLink";
import { useInviteLinkChanges } from "./useInviteLinkChanges";
import { useInviteLinks } from "./useInviteLinks";

/**
 * The invite-link section of a group page. The two status regions stay in the page and only their
 * text changes, so screen readers announce each message. Focus moves to the change message.
 */
export function InviteLinks({
  groupId,
  members,
  onUnauthenticated,
}: {
  groupId: string;
  members: Group["members"];
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const { state, reload } = useInviteLinks(groupId, onUnauthenticated);
  const {
    state: change,
    create,
    revoke,
  } = useInviteLinkChanges(groupId, reload, onUnauthenticated);
  const { state: copy, copy: copyLink } = useCopyInviteLink();
  const changeRef = useRef<HTMLParagraphElement>(null);
  const saving = change.status === "saving";

  useEffect(() => {
    if (change.status === "done") changeRef.current?.focus();
  }, [change]);

  return (
    <section>
      <h2>{m.inviteLinksHeading}</h2>
      <InviteLinkList
        state={state}
        members={members}
        busy={saving}
        onRetry={reload}
        onCopy={copyLink}
        onRevoke={revoke}
      />
      <p role="status" className="status">
        {copy === "copied" && m.inviteLinkCopied}
        {copy === "failed" && m.inviteLinkCopyFailed}
      </p>
      <CreateInviteLinkForm busy={saving} onSubmit={create} />
      <p ref={changeRef} tabIndex={-1} role="status" className="status">
        {change.status === "done" &&
          (change.change === "created"
            ? m.inviteLinkCreated
            : m.inviteLinkRevoked)}
      </p>
      {change.status === "failed" && (
        <Alert>{toUserMessage(change.code)}</Alert>
      )}
    </section>
  );
}
