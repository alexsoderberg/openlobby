import type { AuthUser } from "../api";
import { useMyGroups } from "../features/groups";
import { AppShell } from "../features/shell";
import { activeNavOf } from "./activeNav";
import { openGroup } from "./openGroup";
import { NotFoundPage, ProtectedPage } from "./Pages";
import type { Route } from "./route";

/** Every page of a logged-in user: the shell around the page. The group list loads once, for the rail and the pages. */
export function LoggedInApp({
  user,
  route,
  logoutError,
  onLogout,
  onUnauthenticated,
}: {
  user: AuthUser;
  route: Route;
  logoutError?: string;
  onLogout: () => void;
  onUnauthenticated: () => void;
}) {
  const groups = useMyGroups(onUnauthenticated);
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
          route={route}
          user={user}
          groups={groups}
          logoutError={logoutError}
          onLogout={onLogout}
          onUnauthenticated={onUnauthenticated}
        />
      )}
    </AppShell>
  );
}
