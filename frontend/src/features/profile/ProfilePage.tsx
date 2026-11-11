import type { AuthUser } from "../../api";
import { useMessages } from "../../i18n";
import { Avatar, ErrorAlert, Icon, Panel } from "../../ui";
import { GAMES_PATH } from "../games";

/** The You page: who is logged in, Log out and, for a system admin only, the way to the game list. A failed logout is shown next to the button. */
export function ProfilePage({
  user,
  logoutError,
  onLogout,
}: {
  user: AuthUser;
  logoutError?: string;
  onLogout: () => void;
}) {
  const m = useMessages();
  return (
    <>
      <h1>{m.profileHeading}</h1>
      <Panel>
        <div className="profile">
          <Avatar name={user.displayName} />
          <div>
            <p className="eyebrow">{m.profileNameLabel}</p>
            <p className="profile__name">{user.displayName}</p>
          </div>
        </div>
        {user.isSystemAdmin && (
          <p>
            <a href={GAMES_PATH}>{m.gameListLink}</a>
          </p>
        )}
        {logoutError && <ErrorAlert code={logoutError} onRetry={onLogout} />}
        <button
          type="button"
          className="button button--secondary"
          onClick={onLogout}
        >
          <Icon name="logOut" />
          {m.logOut}
        </button>
      </Panel>
    </>
  );
}
