import { GROUPS_PATH } from "./groupPath";
import { Lobbies } from "../lobbies";
import { useMessages } from "../../i18n";
import type { ReactNode } from "react";
import { ErrorAlert, Panel } from "../../ui";
import type { GroupState } from "./useGroup";

/** Shows a group with its members. The admin marker is text, so it does not depend on color. */
export function GroupDetails({
  state,
  onRetry,
  onUnauthenticated,
  headerAction,
}: {
  state: Exclude<GroupState, { status: "notFound" }>;
  onRetry: () => void;
  onUnauthenticated: () => void;
  /** Shown next to the heading, e.g. the Invite button. */
  headerAction?: ReactNode;
}) {
  const m = useMessages();

  if (state.status === "loading") return <p role="status">{m.groupLoading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={onRetry} />;

  return (
    <>
      <p className="crumb">
        <a href={GROUPS_PATH}>{m.backToGroups}</a>
      </p>
      <div className="page-heading">
        <h1>{state.group.name}</h1>
        {headerAction}
      </div>
      <div className="panel-group">
        <Lobbies
          groupId={state.group.id}
          members={state.group.members}
          onUnauthenticated={onUnauthenticated}
        />
        <Panel>
          <h2>{m.membersHeading}</h2>
          <ul className="row-list" role="list">
            {state.group.members.map((member) => (
              <li key={member.userId} className="list-row">
                <span className="avatar" />
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
        </Panel>
      </div>
    </>
  );
}
