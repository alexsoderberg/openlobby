import type { ReactNode } from "react";
import type { AuthUser, GroupSummary } from "../../api";
import { CreateGroup, type GroupsState } from "../groups";
import type { ActiveNav } from "./activeNav";
import { CreateGroupButton } from "./CreateGroupButton";
import { CreateGroupPopover } from "./CreateGroupPopover";
import { GroupRail } from "./GroupRail";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";
import { useCreateGroupPopover } from "./useCreateGroupPopover";

/**
 * The layout of every logged-in page: Top bar, Group rail (wide) or Tab bar (phones), and the page in the
 * main area. The "+" creates a group; what happens to the new group is the caller's choice.
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
  const popover = useCreateGroupPopover();
  return (
    <div className="shell">
      <TopBar user={user} profileActive={active.section === "profile"} />
      <GroupRail
        groups={groups.status === "loaded" ? groups.groups : []}
        active={active}
        createOpen={popover.open}
        onCreate={popover.press}
      />
      <main className="shell__main" tabIndex={-1}>
        {children}
      </main>
      <TabBar active={active} />
      <CreateGroupButton
        className="plus-button plus-button--fab"
        open={popover.open}
        onPress={popover.press}
      />
      <CreateGroupPopover
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
      </CreateGroupPopover>
    </div>
  );
}
