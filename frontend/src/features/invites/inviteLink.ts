const INVITE_PATH_PREFIX = "/invite/";

/** The full address that is copied and shared (ADR 0007). */
export function inviteUrl(token: string): string {
  return `${window.location.origin}${INVITE_PATH_PREFIX}${token}`;
}

/** The expiry time in the user's own time zone and locale. */
export function formatExpiry(expiresAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(expiresAt));
}
