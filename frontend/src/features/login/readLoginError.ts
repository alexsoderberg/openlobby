import { isLoginErrorCode, type LoginErrorCode } from "../../i18n";

const LOGIN_ERROR_PARAM = "loginError";
const FALLBACK_LOGIN_ERROR: LoginErrorCode = "login_failed";

/** Reads the code the callback put in the URL. An unknown code is shown as a generic failure. */
export function readLoginError(search: string): LoginErrorCode | undefined {
  const value = new URLSearchParams(search).get(LOGIN_ERROR_PARAM);
  if (value === null) return undefined;
  return isLoginErrorCode(value) ? value : FALLBACK_LOGIN_ERROR;
}

/** The query string without the login result, so it can be used as part of returnTo. */
export function withoutLoginError(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(LOGIN_ERROR_PARAM);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
