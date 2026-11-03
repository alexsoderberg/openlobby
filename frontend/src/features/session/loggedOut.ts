import type { LoginErrorCode, Messages } from "../../i18n";
import type { LoggedOutReason } from "./useSession";

/** What a logged-out view needs: where login returns to, and why the user is logged out. */
export type LoggedOutPageProps = {
  returnTo: string;
  loginError?: LoginErrorCode;
  reason: LoggedOutReason;
};

/** A login result from the callback wins; otherwise an expired session is explained. */
export function loggedOutNotice(
  m: Messages,
  loginError: LoginErrorCode | undefined,
  reason: LoggedOutReason,
): string | undefined {
  if (loginError) return m.loginErrors[loginError];
  return reason === "expired" ? m.sessionExpired : undefined;
}
