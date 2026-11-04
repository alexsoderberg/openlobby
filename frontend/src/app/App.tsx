import { LandingPage } from "../features/landing";
import { useSession } from "../features/session";
import { Header } from "./Header";
import { NotFoundPage, ProtectedPage } from "./Pages";
import { RequireLogin } from "./RequireLogin";
import { routeFor } from "./route";
import { useEntryLocation } from "./useEntryLocation";

export function App() {
  const entry = useEntryLocation();
  const { session, reload, logout, logoutError, markExpired } = useSession();
  const route = routeFor(entry.pathname);
  const user = session.status === "loggedIn" ? session.user : undefined;

  // The logged-out start page is the landing page, which has its own top bar.
  if (route.name === "start" && session.status === "loggedOut") {
    return (
      <LandingPage
        returnTo={entry.returnTo}
        loginError={entry.loginError}
        reason={session.reason}
      />
    );
  }

  return (
    <>
      <Header
        displayName={user?.displayName}
        showGameList={user?.isSystemAdmin}
        logoutError={logoutError}
        onLogout={logout}
      />
      <main className="page">
        {route.name === "notFound" ? (
          <NotFoundPage />
        ) : (
          <RequireLogin
            session={session}
            returnTo={entry.returnTo}
            loginError={entry.loginError}
            onRetry={reload}
          >
            <ProtectedPage
              route={route}
              isSystemAdmin={user?.isSystemAdmin ?? false}
              onUnauthenticated={markExpired}
            />
          </RequireLogin>
        )}
      </main>
    </>
  );
}
