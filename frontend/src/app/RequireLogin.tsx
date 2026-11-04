import type { SessionState } from "../features/session";
import { LoginPanel } from "../features/login";
import { useMessages, type LoginErrorCode } from "../i18n";
import { ErrorAlert } from "../ui";

type RequireLoginProps = {
  session: Exclude<SessionState, { status: "loggedIn" }>;
  returnTo: string;
  loginError?: LoginErrorCode;
  onRetry: () => void;
};

/** What a visitor sees instead of a protected page: the check, its failure with a retry, or the login. */
export function RequireLogin({
  session,
  returnTo,
  loginError,
  onRetry,
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
  }
}
