import { useMessages } from "../i18n";
import { GAMES_PATH } from "../features/games";
import { Brand, ErrorAlert } from "../ui";

type HeaderProps = {
  displayName?: string;
  showGameList?: boolean;
  logoutError?: string;
  onLogout: () => void;
};

/** Shows the account only when logged in, and the game list link only to a system admin. A failed logout is shown next to the button. */
export function Header({
  displayName,
  showGameList,
  logoutError,
  onLogout,
}: HeaderProps) {
  const m = useMessages();

  return (
    <header className="app-header">
      <Brand />
      {displayName !== undefined && (
        <div className="account">
          {showGameList && <a href={GAMES_PATH}>{m.gameListLink}</a>}
          <span className="account__name">{displayName}</span>
          {logoutError && <ErrorAlert code={logoutError} onRetry={onLogout} />}
          <button
            type="button"
            className="button button--secondary"
            onClick={onLogout}
          >
            {m.logOut}
          </button>
        </div>
      )}
    </header>
  );
}
