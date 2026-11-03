import {
  GroupDetails,
  MyGroups,
  groupPath,
  useGroup,
} from "../features/groups";
import { InvitePage } from "../features/invites";
import { useMessages } from "../i18n";
import { Panel } from "../ui";
import type { Route } from "./route";

export function ProtectedPage({
  route,
  onUnauthenticated,
}: {
  route: Exclude<Route, { name: "notFound" }>;
  onUnauthenticated: () => void;
}) {
  switch (route.name) {
    case "start":
      return <StartPage onUnauthenticated={onUnauthenticated} />;
    case "group":
      return (
        <GroupPage
          groupId={route.groupId}
          onUnauthenticated={onUnauthenticated}
        />
      );
    case "invite":
      return (
        <InvitePage
          token={route.token}
          onGroupOpened={openGroup}
          onUnauthenticated={onUnauthenticated}
        />
      );
  }
}

function StartPage({ onUnauthenticated }: { onUnauthenticated: () => void }) {
  const m = useMessages();
  return (
    <>
      <h1>{m.groupsHeading}</h1>
      <MyGroups onUnauthenticated={onUnauthenticated} />
    </>
  );
}

/** A group the caller is not in gives the same page as an unknown address, so its existence is not revealed. */
function GroupPage({
  groupId,
  onUnauthenticated,
}: {
  groupId: string;
  onUnauthenticated: () => void;
}) {
  const { state, reload } = useGroup(groupId, onUnauthenticated);
  if (state.status === "notFound") return <NotFoundPage />;
  return (
    <GroupDetails
      state={state}
      onRetry={reload}
      onUnauthenticated={onUnauthenticated}
    />
  );
}

/** Full-page navigation, so the group page loads its own data from the start. */
function openGroup(groupId: string) {
  window.location.assign(groupPath(groupId));
}

export function NotFoundPage() {
  const m = useMessages();
  return (
    <>
      <h1>{m.notFoundHeading}</h1>
      <Panel>
        <p>{m.notFoundText}</p>
        <a href="/">{m.backToStart}</a>
      </Panel>
    </>
  );
}
