import type { ReactNode } from "react";
import type { AuthUser } from "../api";
import { Dashboard } from "../features/dashboard";
import { GamesPage } from "../features/games";
import {
  GroupDetails,
  GroupListPage,
  LeaveGroupAction,
  groupPath,
  useGroup,
  type GroupsState,
} from "../features/groups";
import { InviteAction, InvitePage } from "../features/invites";
import { LobbyDetailPage } from "../features/lobbies";
import { ProfilePage } from "../features/profile";
import { useMessages } from "../i18n";
import { ErrorAlert, Panel } from "../ui";
import { navigate } from "./navigation";
import type { Route } from "./route";

export type MyGroupsLoad = { state: GroupsState; reload: () => void };

export function ProtectedPage({
  route,
  user,
  groups,
  createGroupButton,
  logoutError,
  onOpenGroup,
  onLeftGroup,
  onLogout,
  onUnauthenticated,
}: {
  route: Exclude<Route, { name: "notFound" }>;
  user: AuthUser;
  groups: MyGroupsLoad;
  createGroupButton: ReactNode;
  logoutError?: string;
  onOpenGroup: (groupId: string) => void;
  onLeftGroup: (group: { id: string; name: string }) => void;
  onLogout: () => void;
  onUnauthenticated: () => void;
}) {
  switch (route.name) {
    case "start":
      return (
        <Dashboard
          groups={groups.state}
          onRetryGroups={groups.reload}
          onUnauthenticated={onUnauthenticated}
        />
      );
    case "groups":
      return (
        <GroupListPage
          createGroupButton={createGroupButton}
          onUnauthenticated={onUnauthenticated}
        />
      );
    case "profile":
      return (
        <ProfilePage
          user={user}
          logoutError={logoutError}
          onLogout={onLogout}
          onUnauthenticated={onUnauthenticated}
        />
      );
    case "group":
      return (
        <GroupPage
          groupId={route.groupId}
          viewerId={user.userId}
          onLeft={onLeftGroup}
          onUnauthenticated={onUnauthenticated}
        />
      );
    case "lobby":
      return (
        <LobbyPageWithGroup
          groupId={route.groupId}
          lobbyId={route.lobbyId}
          userId={user.userId}
          onUnauthenticated={onUnauthenticated}
        />
      );
    case "games":
      return (
        <GamesPage
          isSystemAdmin={user.isSystemAdmin}
          onUnauthenticated={onUnauthenticated}
        />
      );
    case "invite":
      return (
        <InvitePage
          token={route.token}
          onGroupOpened={onOpenGroup}
          onUnauthenticated={onUnauthenticated}
        />
      );
  }
}

/** A group the caller is not in gives the same page as an unknown address, so its existence is not revealed. */
function GroupPage({
  groupId,
  viewerId,
  onLeft,
  onUnauthenticated,
}: {
  groupId: string;
  viewerId: string;
  onLeft: (group: { id: string; name: string }) => void;
  onUnauthenticated: () => void;
}) {
  const { state, reload, refresh } = useGroup(groupId, onUnauthenticated);
  if (state.status === "notFound") return <NotFoundPage />;
  return (
    <GroupDetails
      state={state}
      viewerId={viewerId}
      onRetry={reload}
      onRefresh={refresh}
      onUnauthenticated={onUnauthenticated}
      headerAction={
        state.status === "loaded" && (
          <InviteAction
            group={state.group}
            onUnauthenticated={onUnauthenticated}
          />
        )
      }
      footerAction={
        state.status === "loaded" && (
          <LeaveGroupAction
            group={state.group}
            onLeft={onLeft}
            onUnauthenticated={onUnauthenticated}
          />
        )
      }
    />
  );
}

/**
 * The lobby page with its group's name and members. Until they load it shows the lobby alone; a failure is shown
 * with a retry above it and does not block the lobby (REQ-0029 item 6).
 */
function LobbyPageWithGroup({
  groupId,
  lobbyId,
  userId,
  onUnauthenticated,
}: {
  groupId: string;
  lobbyId: string;
  userId: string;
  onUnauthenticated: () => void;
}) {
  const { state, reload } = useGroup(groupId, onUnauthenticated);
  return (
    <>
      {state.status === "error" && (
        <ErrorAlert code={state.code} onRetry={reload} />
      )}
      <LobbyDetailPage
        groupId={groupId}
        lobbyId={lobbyId}
        group={state.status === "loaded" ? state.group : undefined}
        userId={userId}
        backHref={groupPath(groupId)}
        onDeleted={() => navigate(groupPath(groupId))}
        onUnauthenticated={onUnauthenticated}
      />
    </>
  );
}

export function NotFoundPage() {
  const m = useMessages();
  return (
    <>
      <h1>{m.notFoundHeading}</h1>
      <Panel>
        <p>{m.notFoundText}</p>
        <a href="/">{m.backToHome}</a>
      </Panel>
    </>
  );
}
