import { useMessages } from "../i18n";
import { ErrorAlert } from "../ui/ErrorAlert";

type HeaderProps = {
  displayName?: string;
  logoutError?: string;
  onLogout: () => void;
};

/** Shows the account only when logged in. A failed logout is shown next to the button. */
export function Header({ displayName, logoutError, onLogout }: HeaderProps) {
  const m = useMessages();

  return (
    <header className="app-header">
      <a className="brand" href="/">
        {m.appName}
      </a>
      {displayName !== undefined && (
        <div className="account">
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
