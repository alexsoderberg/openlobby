import { GROUPS_PATH } from "./groupPath";
import { Lobbies } from "../lobbies";
import { useMessages } from "../../i18n";
import { PreferredGameRolesNote } from "../../lobby";
import type { ReactNode } from "react";
import { ErrorAlert, Panel } from "../../ui";
import type { GroupState } from "./useGroup";
import { MakeGroupAdminAction } from "./MakeGroupAdminAction";

/** Shows a group with its members. The admin marker is text, so it does not depend on color. */
export function GroupDetails({
  state,
  viewerId,
  onRetry,
  onRefresh,
  onUnauthenticated,
  headerAction,
}: {
  state: Exclude<GroupState, { status: "notFound" }>;
  /** The logged-in user, to tell whether they may make others group admins. */
  viewerId: string;
  onRetry: () => void;
  /** Loads the group again without leaving the page. */
  onRefresh: () => void;
  onUnauthenticated: () => void;
  /** Shown next to the heading, e.g. the Invite button. */
  headerAction?: ReactNode;
}) {
  const m = useMessages();

  if (state.status === "loading") return <p role="status">{m.groupLoading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={onRetry} />;

  const viewerIsAdmin = state.group.members.some(
    (member) => member.userId === viewerId && member.role === "admin",
  );

  return (
    <>
      <p className="crumb">
        <a href={GROUPS_PATH}>{m.backToGroups}</a>
      </p>
      <div className="page-heading">
        <h1>{state.group.name}</h1>
        {headerAction}
      </div>
      <div className="panel-group panel-group--aside">
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
                <PreferredGameRolesNote
                  roles={member.preferredGameRoles}
                  withGame
                />
                {member.role === "admin" && (
                  <>
                    {" "}
                    <span className="badge">{m.groupAdminMarker}</span>
                  </>
                )}
                {viewerIsAdmin && member.role !== "admin" && (
                  <MakeGroupAdminAction
                    groupId={state.group.id}
                    member={member}
                    onSettled={onRefresh}
                    onUnauthenticated={onUnauthenticated}
                  />
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
