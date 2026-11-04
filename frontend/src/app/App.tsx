import { useEffect } from "react";
import { LandingPage } from "../features/landing";
import { useSession } from "../features/session";
import { Brand } from "../ui";
import { LoggedInApp } from "./LoggedInApp";
import { NotFoundPage } from "./Pages";
import { RequireLogin } from "./RequireLogin";
import { routeFor, type Route } from "./route";
import { useEntryLocation } from "./useEntryLocation";

const START_PATH = "/";
const START: Route = { name: "start" };

export function App() {
  const entry = useEntryLocation();
  const { session, reload, logout, logoutError, markExpired } = useSession();
  // After a logout the user starts over at the landing page, whichever page the button was on.
  const loggedOutByUser =
    session.status === "loggedOut" && session.reason === "loggedOut";
  const route = loggedOutByUser ? START : routeFor(entry.pathname);
  const returnTo = loggedOutByUser ? START_PATH : entry.returnTo;

  useEffect(() => {
    if (loggedOutByUser) window.history.replaceState(null, "", START_PATH);
  }, [loggedOutByUser]);

  if (session.status === "loggedIn")
    return (
      <LoggedInApp
        user={session.user}
        route={route}
        logoutError={logoutError}
        onLogout={logout}
        onUnauthenticated={markExpired}
      />
    );

  // The logged-out start page is the landing page, which has its own top bar.
  if (route.name === "start" && session.status === "loggedOut") {
    return (
      <LandingPage
        returnTo={returnTo}
        loginError={entry.loginError}
        reason={session.reason}
      />
    );
  }

  return (
    <>
      <header className="app-header">
        <Brand />
      </header>
      <main className="page">
        {route.name === "notFound" ? (
          <NotFoundPage />
        ) : (
          <RequireLogin
            session={session}
            returnTo={returnTo}
            loginError={entry.loginError}
            onRetry={reload}
          />
        )}
      </main>
    </>
  );
}
