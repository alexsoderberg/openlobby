import { GroupDetails, MyGroups, useGroup } from "../features/groups";
import { useMessages } from "../i18n";
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
      return <InvitePage />;
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
  return <GroupDetails state={state} onRetry={reload} />;
}

/** Placeholder: the invite flow is REQ-0002. */
function InvitePage() {
  const m = useMessages();
  return (
    <>
      <h1>{m.inviteHeading}</h1>
      <p>{m.invitePlaceholder}</p>
    </>
  );
}

export function NotFoundPage() {
  const m = useMessages();
  return (
    <>
      <h1>{m.notFoundHeading}</h1>
      <p>{m.notFoundText}</p>
      <a href="/">{m.backToStart}</a>
    </>
  );
}
