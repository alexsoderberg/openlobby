import { useCallback, useEffect, useRef } from "react";
import type { AuthUser } from "../api";
import { groupPath, useMyGroups } from "../features/groups";
import { AppShell } from "../features/shell";
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
  return (
    <AppShell
      user={user}
      groups={groups.state}
      active={activeNavOf(route)}
      onGroupCreated={(group) => openGroup(group.id)}
      onUnauthenticated={onUnauthenticated}
    >
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
    document.querySelector<HTMLElement>("main")?.focus();
  }, [pathname]);
}
