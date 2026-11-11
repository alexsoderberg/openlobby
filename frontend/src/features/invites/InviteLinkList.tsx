import type { Group, InviteLink } from "../../api";
import { useMessages } from "../../i18n";
import { ErrorAlert, IconButton, Meter } from "../../ui";
import { useReveal } from "../../hooks";
import { RevokeInviteLinkControl } from "./RevokeInviteLinkControl";
import { formatExpiry, inviteUrl } from "./inviteLink";
import type { InviteLinksState } from "./useInviteLinks";

/** Shows the active links. Each link has a copy button and a revoke button with a confirmation step. */
export function InviteLinkList({
  state,
  members,
  busy,
  onRetry,
  onCopy,
  onRevoke,
}: {
  state: InviteLinksState;
  members: Group["members"];
  busy: boolean;
  onRetry: () => void;
  onCopy: (token: string) => void;
  onRevoke: (linkId: string) => void;
}) {
  const m = useMessages();

  if (state.status === "loading") return <p>{m.inviteLinksLoading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={onRetry} />;
  if (state.links.length === 0) return <p>{m.inviteLinksEmpty}</p>;

  return (
    <ul className="row-list" role="list">
      {state.links.map((link) => (
        <InviteLinkItem
          key={link.id}
          link={link}
          creator={
            members.find((member) => member.userId === link.createdByUserId)
              ?.displayName ?? m.inviteLinkUnknownCreator
          }
          busy={busy}
          onCopy={onCopy}
          onRevoke={onRevoke}
        />
      ))}
    </ul>
  );
}

function InviteLinkItem({
  link,
  creator,
  busy,
  onCopy,
  onRevoke,
}: {
  link: InviteLink;
  creator: string;
  busy: boolean;
  onCopy: (token: string) => void;
  onRevoke: (linkId: string) => void;
}) {
  const m = useMessages();
  const revealRef = useReveal<HTMLLIElement>();
  const expires = formatExpiry(link.expiresAt);
  const description = `${m.inviteLinkCreatedBy(creator)}, ${m.inviteLinkExpires(expires)}`;

  return (
    <li ref={revealRef} className="invite-link">
      <InviteLinkMeta
        link={link}
        creator={creator}
        expires={expires}
        description={description}
      />
      <div className="invite-link__actions">
        <input
          className="invite-link__url"
          type="text"
          readOnly
          value={inviteUrl(link.token)}
          aria-label={`${m.inviteLinkUrlLabel}, ${description}`}
          onFocus={(event) => event.currentTarget.select()}
        />
        <IconButton
          icon="copy"
          label={m.inviteLinkCopy}
          subject={description}
          disabled={busy}
          onClick={() => onCopy(link.token)}
        />
        <RevokeInviteLinkControl
          linkId={link.id}
          description={description}
          busy={busy}
          onRevoke={onRevoke}
        />
      </div>
    </li>
  );
}

function InviteLinkMeta({
  link,
  creator,
  expires,
  description,
}: {
  link: InviteLink;
  creator: string;
  expires: string;
  description: string;
}) {
  const m = useMessages();

  return (
    <>
      <p className="invite-link__uses">
        <span>{m.inviteLinkUses(link.useCount, link.maxUses)}</span>
        <span className="visually-hidden"> {m.inviteLinkUsesWord}</span>
      </p>
      <Meter
        value={link.useCount}
        max={link.maxUses}
        label={`${m.inviteLinkUsesWord}, ${description}`}
      />
      <p className="invite-link__meta">
        <span>{m.inviteLinkCreatedBy(creator)}</span>
        <time dateTime={link.expiresAt}>{m.inviteLinkExpires(expires)}</time>
      </p>
    </>
  );
}
