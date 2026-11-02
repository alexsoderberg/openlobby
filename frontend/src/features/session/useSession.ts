import { useCallback, useEffect, useState } from "react";
import {
  errorCodeOf,
  isUnauthenticated,
  useApi,
  type AuthUser,
} from "../../api";

export type LoggedOutReason = "start" | "expired" | "loggedOut";

export type SessionState =
  | { status: "loading" }
  | { status: "loggedOut"; reason: LoggedOutReason }
  | { status: "loggedIn"; user: AuthUser }
  | { status: "error"; code: string };

const STARTED_LOGGED_OUT: SessionState = {
  status: "loggedOut",
  reason: "start",
};
const EXPIRED: SessionState = { status: "loggedOut", reason: "expired" };
const LOGGED_OUT_BY_USER: SessionState = {
  status: "loggedOut",
  reason: "loggedOut",
};

function sessionFromError(error: unknown): SessionState {
  return isUnauthenticated(error)
    ? STARTED_LOGGED_OUT
    : { status: "error", code: errorCodeOf(error) };
}

/** Owns the login state. The server decides it; the browser only remembers the last answer. */
export function useSession() {
  const api = useApi();
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [logoutError, setLogoutError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    api.getCurrentUser().then(
      (user) => {
        if (!ignore) setSession({ status: "loggedIn", user });
      },
      (error: unknown) => {
        if (!ignore) setSession(sessionFromError(error));
      },
    );
    return () => {
      ignore = true;
    };
  }, [api, attempt]);

  const reload = useCallback(() => {
    setSession({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  /** A failed logout keeps the account view, so the user sees the error next to the button. */
  const logout = useCallback(async () => {
    setLogoutError(undefined);
    try {
      await api.logout();
      setSession(LOGGED_OUT_BY_USER);
    } catch (error) {
      setLogoutError(errorCodeOf(error));
    }
  }, [api]);

  const markExpired = useCallback(() => setSession(EXPIRED), []);

  return { session, reload, logout, logoutError, markExpired };
}
