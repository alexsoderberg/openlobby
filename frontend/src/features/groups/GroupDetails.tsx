import { InviteLinks } from "../invites";
import { useMessages } from "../../i18n";
import { ErrorAlert } from "../../ui/ErrorAlert";
import type { GroupState } from "./useGroup";

/** Shows a group with its members and invite links. The admin marker is text, so it does not depend on color. */
export function GroupDetails({
  state,
  onRetry,
  onUnauthenticated,
}: {
  state: Exclude<GroupState, { status: "notFound" }>;
  onRetry: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();

  if (state.status === "loading") return <p role="status">{m.groupLoading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={onRetry} />;

  return (
    <>
      <h1>{state.group.name}</h1>
      <h2>{m.membersHeading}</h2>
      <ul className="item-list">
        {state.group.members.map((member) => (
          <li key={member.userId}>
            {member.displayName}
            {member.role === "admin" && (
              <>
                {" "}
                <span className="badge">{m.groupAdminMarker}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      <InviteLinks
        groupId={state.group.id}
        members={state.group.members}
        onUnauthenticated={onUnauthenticated}
      />
      <a href="/">{m.backToStart}</a>
    </>
  );
}
