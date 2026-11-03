import { useCallback, useState } from "react";
import {
  errorCodeOf,
  isUnauthenticated,
  useApi,
  type AuthUser,
} from "../../api";
import { useLoad, type LoadState } from "../../hooks";

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

function sessionOf(load: LoadState<AuthUser>): SessionState {
  switch (load.status) {
    case "loading":
      return { status: "loading" };
    case "loaded":
      return { status: "loggedIn", user: load.value };
    case "failed":
      return sessionFromError(load.error);
  }
}

/** Owns the login state. The server decides it; the browser only remembers the last answer. */
export function useSession() {
  const api = useApi();
  const getCurrentUser = useCallback(() => api.getCurrentUser(), [api]);
  const { state: load, reload: reloadUser } = useLoad(getCurrentUser);
  // A logout or an expired session overrides the loaded answer until the next check.
  const [override, setOverride] = useState<SessionState>();
  const [logoutError, setLogoutError] = useState<string>();

  const reload = useCallback(() => {
    setOverride(undefined);
    reloadUser();
  }, [reloadUser]);

  /** A failed logout keeps the account view, so the user sees the error next to the button. */
  const logout = useCallback(async () => {
    setLogoutError(undefined);
    try {
      await api.logout();
      setOverride(LOGGED_OUT_BY_USER);
    } catch (error) {
      setLogoutError(errorCodeOf(error));
    }
  }, [api]);

  const markExpired = useCallback(() => setOverride(EXPIRED), []);

  return {
    session: override ?? sessionOf(load),
    reload,
    logout,
    logoutError,
    markExpired,
  };
}
