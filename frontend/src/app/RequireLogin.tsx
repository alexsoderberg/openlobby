import type { ReactNode } from "react";
import type { SessionState } from "../features/session";
import { LoginPanel } from "../features/login";
import { useMessages, type LoginErrorCode } from "../i18n";
import { ErrorAlert } from "../ui";

type RequireLoginProps = {
  session: SessionState;
  returnTo: string;
  loginError?: LoginErrorCode;
  onRetry: () => void;
  children: ReactNode;
};

/** Shows the page only to a logged-in user. Every other state has its own view. */
export function RequireLogin({
  session,
  returnTo,
  loginError,
  onRetry,
  children,
}: RequireLoginProps) {
  const m = useMessages();

  switch (session.status) {
    case "loading":
      return <p role="status">{m.sessionLoading}</p>;
    case "error":
      return <ErrorAlert code={session.code} onRetry={onRetry} />;
    case "loggedOut":
      return (
        <LoginPanel
          returnTo={returnTo}
          loginError={loginError}
          reason={session.reason}
        />
      );
    case "loggedIn":
      return children;
  }
}
