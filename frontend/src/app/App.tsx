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
  const displayName =
    session.status === "loggedIn" ? session.user.displayName : undefined;

  return (
    <>
      <Header
        displayName={displayName}
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
            <ProtectedPage route={route} onUnauthenticated={markExpired} />
          </RequireLogin>
        )}
      </main>
    </>
  );
}
