import { MyGroups } from "../features/groups";
import { useMessages } from "../i18n";
import type { Route } from "./route";

export function ProtectedPage({
  route,
  onUnauthenticated,
}: {
  route: Exclude<Route, "notFound">;
  onUnauthenticated: () => void;
}) {
  return route === "start" ? (
    <StartPage onUnauthenticated={onUnauthenticated} />
  ) : (
    <InvitePage />
  );
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
