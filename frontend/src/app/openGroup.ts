import { groupPath } from "../features/groups";

/** Full-page navigation, so the group page loads its own data from the start. */
export function openGroup(groupId: string) {
  window.location.assign(groupPath(groupId));
}
