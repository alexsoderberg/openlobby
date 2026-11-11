import { useRef } from "react";
import { loginUrl } from "../../api";
import { useFocusAfterLogout } from "../../hooks";
import { useMessages } from "../../i18n";
import { Alert, Icon } from "../../ui";
import { loggedOutNotice, type LoggedOutPageProps } from "../session";

export function LoginPanel({
  returnTo,
  loginError,
  reason,
}: LoggedOutPageProps) {
  const m = useMessages();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusAfterLogout(headingRef, reason === "loggedOut");

  const notice = loggedOutNotice(m, loginError, reason);

  return (
    <section className="login-panel">
      <h1 ref={headingRef} tabIndex={-1}>
        {m.loginHeading}
      </h1>
      {notice && <Alert>{notice}</Alert>}
      <p>{m.loginIntro}</p>
      <a className="button" href={loginUrl(returnTo)}>
        <Icon name="logIn" />
        {m.logInWithDiscord}
      </a>
    </section>
  );
}
