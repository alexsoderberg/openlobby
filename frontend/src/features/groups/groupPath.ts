/** The address of the list of the caller's groups. */
export const GROUPS_PATH = "/groups";
const GROUP_PATH_PREFIX = "/groups/";
const GROUP_PATH = new RegExp(`^${GROUP_PATH_PREFIX}([^/]+)$`);

/** The address of a group page. The router reads addresses back with groupIdFromPath. */
export function groupPath(groupId: string): string {
  return `${GROUP_PATH_PREFIX}${groupId}`;
}

/** The group id in a group page address, or undefined for any other address. */
export function groupIdFromPath(pathname: string): string | undefined {
  return GROUP_PATH.exec(pathname)?.[1];
}
