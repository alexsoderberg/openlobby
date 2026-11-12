import type { AuthUser } from "../../api";
import { useMessages } from "../../i18n";
import { Avatar, ErrorAlert, Icon, Panel } from "../../ui";
import { GAMES_PATH } from "../games";

/**
 * The You page as account settings (REQ-0020): Account, System admin for a system admin only, then Log out last.
 * A later settings section goes above Log out. A failed logout is shown next to the button.
 */
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
      <div className="panel-group">
        <Panel>
          <h2>{m.profileAccountHeading}</h2>
          <div className="profile">
            <Avatar name={user.displayName} />
            <div>
              <p className="eyebrow">{m.profileNameLabel}</p>
              <p className="profile__name">{user.displayName}</p>
            </div>
          </div>
        </Panel>
        {user.isSystemAdmin && (
          <Panel>
            <h2>{m.profileSystemAdminHeading}</h2>
            <a className="list-row nav-row" href={GAMES_PATH}>
              <Icon name="gameList" />
              {m.gameListLink}
              <Icon name="chevronRight" className="nav-row__chevron" />
            </a>
          </Panel>
        )}
        <Panel>
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
      </div>
    </>
  );
}
