import { useEffect, useState, type ReactNode } from "react";
import type { AuthUser, GroupSummary } from "../../api";
import { usePopover } from "../../hooks";
import { useMessages } from "../../i18n";
import { Popover } from "../../ui";
import { CreateGroup, type GroupsState } from "../groups";
import { InvitePopover } from "../invites";
import type { ActiveNav } from "./activeNav";
import { CreateGroupButton } from "./CreateGroupButton";
import { GroupRail } from "./GroupRail";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";

/**
 * The layout of every logged-in page: Top bar, Group rail (wide) or Tab bar (phones), and the page in the
 * main area. The "+" creates a group and shows only on the Group list; what happens to the new group is
 * the caller's choice.
 */
export function AppShell({
  user,
  groups,
  active,
  onGroupCreated,
  onUnauthenticated,
  children,
}: {
  user: AuthUser;
  groups: GroupsState;
  active: ActiveNav;
  onGroupCreated: (group: GroupSummary) => void;
  onUnauthenticated: () => void;
  children: ReactNode;
}) {
  const m = useMessages();
  const popover = usePopover();
  const invite = usePopover();
  const [inviteGroup, setInviteGroup] = useState<GroupSummary>();
  const canCreateGroup = active.section === "groups" && !active.groupId;
  const { open, close } = popover;
  // The "+" is gone on other pages, so a form left open would have nothing to return to.
  useEffect(() => {
    if (!canCreateGroup && open) close();
  }, [canCreateGroup, open, close]);
  return (
    <div className="shell">
      <TopBar user={user} profileActive={active.section === "profile"} />
      <GroupRail
        groups={groups.status === "loaded" ? groups.groups : []}
        active={active}
        onCreate={canCreateGroup ? popover.press : undefined}
        createOpen={popover.open}
        onInvite={(group, icon) => {
          setInviteGroup(group);
          invite.press(icon);
        }}
      />
      <main
        className={
          canCreateGroup ? "shell__main shell__main--fab" : "shell__main"
        }
        tabIndex={-1}
      >
        {children}
      </main>
      <TabBar active={active} />
      {canCreateGroup && (
        <CreateGroupButton
          className="plus-button plus-button--fab"
          open={popover.open}
          onPress={popover.press}
        />
      )}
      <Popover
        label={m.createGroupHeading}
        open={popover.open}
        origin={popover.origin}
        frameRef={popover.popoverRef}
        onClose={popover.close}
      >
        {popover.opening > 0 && (
          <CreateGroup
            key={popover.opening}
            onCreated={onGroupCreated}
            onCancel={popover.close}
            onUnauthenticated={onUnauthenticated}
          />
        )}
      </Popover>
      <InvitePopover
        group={inviteGroup}
        popover={invite}
        onUnauthenticated={onUnauthenticated}
      />
    </div>
  );
}
