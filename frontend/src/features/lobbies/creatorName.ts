import type { Lobby } from "../../api";

/** The name of the member who created the lobby, or the fallback when they have left the group. */
export function creatorName(
  members: { userId: string; displayName: string }[],
  lobby: Lobby,
  fallback: string,
): string {
  return (
    members.find((member) => member.userId === lobby.createdByUserId)
      ?.displayName ?? fallback
  );
}
