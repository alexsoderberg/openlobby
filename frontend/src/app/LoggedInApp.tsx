import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthUser } from "../api";
import { GROUPS_PATH, groupPath, useMyGroups } from "../features/groups";
import { AppShell } from "../features/shell";
import { useMessages } from "../i18n";
import { activeNavOf } from "./activeNav";
import { navigate } from "./navigation";
import { NotFoundPage, ProtectedPage } from "./Pages";
import type { Route } from "./route";

/** Every page of a logged-in user: the shell around the page. The group list loads once, for the rail and the pages. */
export function LoggedInApp({
  user,
  route,
  pathname,
  logoutError,
  onLogout,
  onUnauthenticated,
}: {
  user: AuthUser;
  route: Route;
  pathname: string;
  logoutError?: string;
  onLogout: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const groups = useMyGroups(onUnauthenticated);
  useFocusMainOnNavigation(pathname);
  // The group list is loaded once, so a new or joined group is fetched again before its page opens.
  const { reload } = groups;
  const openGroup = useCallback(
    (groupId: string) => {
      reload();
      navigate(groupPath(groupId));
    },
    [reload],
  );
  const [leftGroupName, setLeftGroupName] = useState<string>();
  const leaveGroup = useCallback(
    (group: { name: string }) => {
      setLeftGroupName(group.name);
      reload();
      navigate(GROUPS_PATH);
    },
    [reload],
  );
  // The notice belongs to the visit to the Group list that the leave led to, so moving on from the list drops it.
  const [previousPathname, setPreviousPathname] = useState(pathname);
  if (previousPathname !== pathname) {
    setPreviousPathname(pathname);
    if (previousPathname === GROUPS_PATH) setLeftGroupName(undefined);
  }
  return (
    <AppShell
      user={user}
      groups={groups.state}
      active={activeNavOf(route)}
      onGroupCreated={(group) => openGroup(group.id)}
      onUnauthenticated={onUnauthenticated}
    >
      {/* Always rendered, so a screen reader announces the text when it is set. */}
      <p role="status">
        {leftGroupName !== undefined && m.groupLeft(leftGroupName)}
      </p>
      {route.name === "notFound" ? (
        <NotFoundPage />
      ) : (
        <ProtectedPage
          key={pathname}
          route={route}
          user={user}
          groups={groups}
          logoutError={logoutError}
          onOpenGroup={openGroup}
          onLeftGroup={leaveGroup}
          onLogout={onLogout}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </AppShell>
  );
}

/** A page change leaves focus on the link that was used, so focus moves to the main area, as a page load would. */
function useFocusMainOnNavigation(pathname: string) {
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    document.querySelector<HTMLElement>("main")?.focus({ preventScroll: true });
  }, [pathname]);
}
