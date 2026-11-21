import { useEffect, type ReactNode } from "react";
import type { AuthUser, GroupSummary } from "../../api";
import { usePopover } from "../../hooks";
import { useMessages } from "../../i18n";
import { CreateFrame } from "../../ui";
import { CreateGroup } from "../groups";
import type { ActiveNav } from "./activeNav";
import { CreateGroupButton } from "./CreateGroupButton";
import { TopBar } from "./TopBar";

/**
 * The layout of every logged-in page: the Top bar, whose nav is the Tab bar on phones, and the page in the main
 * area. The "+" creates a group and shows only on the Group list: the page puts the header "+" it is given in
 * its heading (wide screens), and the shell floats one above the Tab bar (phones). What happens to the new group
 * is the caller's choice.
 */
export function AppShell({
  user,
  active,
  onGroupCreated,
  onUnauthenticated,
  children,
}: {
  user: AuthUser;
  active: ActiveNav;
  onGroupCreated: (group: GroupSummary) => void;
  onUnauthenticated: () => void;
  /** Gets the header "+" of the Group list. */
  children: (createGroupButton: ReactNode) => ReactNode;
}) {
  const m = useMessages();
  const popover = usePopover();
  const canCreateGroup = active.section === "groups" && !active.groupId;
  const { open, close } = popover;
  // The "+" is gone on other pages, so a form left open would have nothing to return to.
  useEffect(() => {
    if (!canCreateGroup && open) close();
  }, [canCreateGroup, open, close]);
  return (
    <div className="shell">
      <TopBar user={user} active={active} />
      <main
        className={
          canCreateGroup ? "shell__main shell__main--fab" : "shell__main"
        }
        tabIndex={-1}
      >
        {children(
          <CreateGroupButton
            className="plus-button plus-button--header"
            open={popover.open}
            onPress={popover.press}
          />,
        )}
      </main>
      {canCreateGroup && (
        <CreateGroupButton
          className="plus-button plus-button--fab"
          open={popover.open}
          onPress={popover.press}
        />
      )}
      <CreateFrame
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
      </CreateFrame>
    </div>
  );
}
