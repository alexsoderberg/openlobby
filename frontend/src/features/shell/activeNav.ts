/** Where the user is, as far as the navigation shows it. Unknown pages (invite, not found) mark nothing. */
export type ActiveNav = {
  section?: "home" | "groups" | "profile";
  /** The group whose page is open, so its icon is marked in the Group rail. */
  groupId?: string;
};

/** The address of the Dashboard. */
export const HOME_PATH = "/";
