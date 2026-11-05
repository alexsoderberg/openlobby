import type { AuthUser } from "../api";
import { Dashboard } from "../features/dashboard";
import { GamesPage } from "../features/games";
import {
  GroupDetails,
  LeaveGroupAction,
  MyGroups,
  groupPath,
  useGroup,
  type GroupsState,
} from "../features/groups";
import { InviteAction, InvitePage } from "../features/invites";
import { LobbyDetailPage } from "../features/lobbies";
import { ProfilePage } from "../features/profile";
import { useMessages } from "../i18n";
import { Panel } from "../ui";
import { navigate } from "./navigation";
import type { Route } from "./route";

export type MyGroupsLoad = { state: GroupsState; reload: () => void };

export function ProtectedPage({
  route,
  user,
  groups,
  logoutError,
  onOpenGroup,
  onLeftGroup,
  onLogout,
  onUnauthenticated,
}: {
  route: Exclude<Route, { name: "notFound" }>;
  user: AuthUser;
  groups: MyGroupsLoad;
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
      return <GroupsPage groups={groups} />;
    case "profile":
      return (
        <ProfilePage
          user={user}
          logoutError={logoutError}
          onLogout={onLogout}
        />
      );
    case "group":
      return (
        <GroupPage
          groupId={route.groupId}
          onLeft={onLeftGroup}
          onUnauthenticated={onUnauthenticated}
        />
      );
    case "lobby":
      return (
        <LobbyDetailPage
          groupId={route.groupId}
          lobbyId={route.lobbyId}
          userId={user.userId}
          backHref={groupPath(route.groupId)}
          onDeleted={() => navigate(groupPath(route.groupId))}
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

function GroupsPage({ groups }: { groups: MyGroupsLoad }) {
  const m = useMessages();
  return (
    <>
      <h1>{m.groupsHeading}</h1>
      <MyGroups state={groups.state} onRetry={groups.reload} />
    </>
  );
}

/** A group the caller is not in gives the same page as an unknown address, so its existence is not revealed. */
function GroupPage({
  groupId,
  onLeft,
  onUnauthenticated,
}: {
  groupId: string;
  onLeft: (group: { id: string; name: string }) => void;
  onUnauthenticated: () => void;
}) {
  const { state, reload } = useGroup(groupId, onUnauthenticated);
  if (state.status === "notFound") return <NotFoundPage />;
  return (
    <GroupDetails
      state={state}
      onRetry={reload}
      onUnauthenticated={onUnauthenticated}
      headerAction={
        state.status === "loaded" && (
          <div className="form-actions">
            <InviteAction
              group={state.group}
              onUnauthenticated={onUnauthenticated}
            />
            <LeaveGroupAction
              group={state.group}
              onLeft={onLeft}
              onUnauthenticated={onUnauthenticated}
            />
          </div>
        )
      }
    />
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
