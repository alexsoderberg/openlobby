import type { AuthUser } from "../../api";
import { useMessages } from "../../i18n";
import { Avatar, Button, ErrorAlert, Icon, Panel } from "../../ui";
import { GAMES_PATH } from "../games";
import { GoalsSection } from "./Goals";
import { PreferredGameRoles } from "./PreferredGameRoles";

/**
 * The You page as account settings (REQ-0020): Account, Game roles (REQ-0021), Goals (REQ-0030), System admin for a
 * system admin only, then Log out last.
 * Each section is its own panel with its heading, so it reads as one bounded unit, and its actions sit inside it.
 * A later settings section goes above Log out. A failed logout is shown next to the button.
 */
export function ProfilePage({
  user,
  logoutError,
  onLogout,
  onUnauthenticated,
}: {
  user: AuthUser;
  logoutError?: string;
  onLogout: () => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  return (
    <>
      <h1 className="page-head">{m.profileHeading}</h1>
      <div className="page-sections settings-page">
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
        <PreferredGameRoles onUnauthenticated={onUnauthenticated} />
        <GoalsSection onUnauthenticated={onUnauthenticated} />
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
        <div className="form-actions">
          {logoutError && <ErrorAlert code={logoutError} onRetry={onLogout} />}
          <Button variant="secondary" type="button" onClick={onLogout}>
            <Icon name="logOut" />
            {m.logOut}
          </Button>
        </div>
      </div>
    </>
  );
}
