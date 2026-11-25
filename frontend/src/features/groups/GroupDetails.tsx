import type { ReactNode } from "react";
import type { Group } from "../../api";
import { groupColorIndex } from "../../groupColor";
import { useMessages } from "../../i18n";
import { Avatar, ErrorAlert, Icon } from "../../ui";
import { Lobbies } from "../lobbies";
import { GameChips } from "./GameChip";
import { GROUPS_PATH } from "./groupPath";
import { MakeGroupAdminAction } from "./MakeGroupAdminAction";
import type { GroupState } from "./useGroup";

/** Shows a group: its header, its lobbies, and its members. The admin marker is text, so it does not depend on color. */
export function GroupDetails({
  state,
  viewerId,
  onRetry,
  onRefresh,
  onUnauthenticated,
  headerAction,
  footerAction,
}: {
  state: Exclude<GroupState, { status: "notFound" }>;
  /** The logged-in user, to tell whether they may make others group admins. */
  viewerId: string;
  onRetry: () => void;
  /** Loads the group again without leaving the page. */
  onRefresh: () => void;
  onUnauthenticated: () => void;
  /** Shown in the header before Create lobby, e.g. the Invite button. */
  headerAction?: ReactNode;
  /** Shown last on the page, after the Member list, e.g. Leave group (REQ-0028 item 7). */
  footerAction?: ReactNode;
}) {
  const m = useMessages();

  if (state.status === "loading") return <p role="status">{m.groupLoading}</p>;
  if (state.status === "error")
    return <ErrorAlert code={state.code} onRetry={onRetry} />;

  const { group } = state;
  return (
    <>
      <p className="crumb">
        <a href={GROUPS_PATH}>
          <Icon name="back" />
          {m.backToGroups}
        </a>
      </p>
      <div className="group-view side-layout">
        <Lobbies
          groupId={group.id}
          groupName={group.name}
          members={group.members}
          renderHeader={({ createButton, upcomingCount }) => (
            <GroupHeader group={group} upcomingCount={upcomingCount}>
              {headerAction}
              {createButton}
            </GroupHeader>
          )}
          onUnauthenticated={onUnauthenticated}
        />
        <div className="side-column">
          <MemberList
            group={group}
            viewerId={viewerId}
            onRefresh={onRefresh}
            onUnauthenticated={onUnauthenticated}
          />
          {footerAction}
        </div>
      </div>
    </>
  );
}

/** The group colour square, the name at display size, the counts, and the actions at the right (REQ-0029 item 5). */
function GroupHeader({
  group,
  upcomingCount,
  children,
}: {
  group: Group;
  upcomingCount?: number;
  children: ReactNode;
}) {
  const m = useMessages();
  const members = m.groupMemberCount(group.members.length);
  return (
    <header className="group-head">
      <span
        className="group-swatch group-swatch--large"
        data-group-color={groupColorIndex(group.id)}
        aria-hidden="true"
      />
      <div className="group-head__title">
        <h1>{group.name}</h1>
        <p className="group-head__summary">
          {upcomingCount === undefined
            ? members
            : m.groupSummary(members, m.groupUpcomingLobbyCount(upcomingCount))}
        </p>
      </div>
      <div className="group-head__actions">{children}</div>
    </header>
  );
}

/** One row per member: the name, the admin marker and the member's Game chips (REQ-0021 Amendment 2026-11-17). */
function MemberList({
  group,
  viewerId,
  onRefresh,
  onUnauthenticated,
}: {
  group: Group;
  viewerId: string;
  onRefresh: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const viewerIsAdmin = group.members.some(
    (member) => member.userId === viewerId && member.role === "admin",
  );
  return (
    <section>
      <div className="heading-row">
        <h2>{m.membersHeading}</h2>
      </div>
      <ul className="row-list" role="list">
        {group.members.map((member) => (
          <li key={member.userId} className="member-row">
            <Avatar name={member.displayName} />
            <span className="member-row__name">{member.displayName}</span>
            {member.role === "admin" && (
              <span className="badge">{m.groupAdminMarker}</span>
            )}
            <GameChips roles={member.preferredGameRoles} />
            {viewerIsAdmin && member.role !== "admin" && (
              <MakeGroupAdminAction
                groupId={group.id}
                member={member}
                onSettled={onRefresh}
                onUnauthenticated={onUnauthenticated}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
