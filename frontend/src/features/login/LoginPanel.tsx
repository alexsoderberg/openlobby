import { useEffect, useRef } from "react";
import { loginUrl } from "../../api";
import { useMessages, type LoginErrorCode, type Messages } from "../../i18n";
import { Alert } from "../../ui/Alert";
import type { LoggedOutReason } from "../session";

type LoginPanelProps = {
  returnTo: string;
  loginError?: LoginErrorCode;
  reason: LoggedOutReason;
};

function noticeFor(
  m: Messages,
  loginError: LoginErrorCode | undefined,
  reason: LoggedOutReason,
): string | undefined {
  if (loginError) return m.loginErrors[loginError];
  return reason === "expired" ? m.sessionExpired : undefined;
}

export function LoginPanel({ returnTo, loginError, reason }: LoginPanelProps) {
  const m = useMessages();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const afterLogout = reason === "loggedOut";

  // After a logout the button the user pressed is gone, so focus moves to the new heading (WCAG 2.4.3).
  useEffect(() => {
    if (afterLogout) headingRef.current?.focus();
  }, [afterLogout]);

  const notice = noticeFor(m, loginError, reason);

  return (
    <section className="login-panel">
      <h1 ref={headingRef} tabIndex={-1}>
        {m.loginHeading}
      </h1>
      {notice && <Alert>{notice}</Alert>}
      <p>{m.loginIntro}</p>
      <a className="button" href={loginUrl(returnTo)}>
        {m.logInWithDiscord}
      </a>
    </section>
  );
}
