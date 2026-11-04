import type { AuthUser } from "../../api";
import { useMessages } from "../../i18n";
import { Avatar, Brand } from "../../ui";
import { PROFILE_PATH } from "../profile";

/** The wordmark and the logged-in user, who links to the You page. */
export function TopBar({
  user,
  profileActive,
}: {
  user: AuthUser;
  profileActive: boolean;
}) {
  const m = useMessages();
  return (
    <header className="top-bar">
      <Brand />
      <a
        className="top-bar__user"
        href={PROFILE_PATH}
        aria-label={m.shell.openProfile(user.displayName)}
        aria-current={profileActive ? "page" : undefined}
      >
        <span className="top-bar__name">{user.displayName}</span>
        <Avatar name={user.displayName} />
      </a>
    </header>
  );
}
