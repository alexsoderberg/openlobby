import type { Group, InviteLink } from "../../api";
import { useMessages } from "../../i18n";
import { ErrorAlert } from "../../ui";
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
    <ul className="item-list">
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
  const expires = formatExpiry(link.expiresAt);
  const description = `${m.inviteLinkCreatedBy(creator)}, ${m.inviteLinkExpires(expires)}`;

  return (
    <li>
      <InviteLinkMeta link={link} creator={creator} expires={expires} />
      <div className="invite-link__actions">
        <input
          className="invite-link__url"
          type="text"
          readOnly
          value={inviteUrl(link.token)}
          aria-label={`${m.inviteLinkUrlLabel}, ${description}`}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          className="button button--secondary"
          aria-label={`${m.inviteLinkCopy}, ${description}`}
          disabled={busy}
          onClick={() => onCopy(link.token)}
        >
          {m.inviteLinkCopy}
        </button>
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
}: {
  link: InviteLink;
  creator: string;
  expires: string;
}) {
  const m = useMessages();

  return (
    <p className="invite-link__meta">
      <span>{m.inviteLinkCreatedBy(creator)}</span>
      <span>
        <span>{m.inviteLinkUses(link.useCount, link.maxUses)}</span>
        <span className="visually-hidden"> {m.inviteLinkUsesWord}</span>
      </span>
      <time dateTime={link.expiresAt}>{m.inviteLinkExpires(expires)}</time>
    </p>
  );
}
