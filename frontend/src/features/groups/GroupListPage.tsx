import type { ReactNode } from "react";
import { useMessages } from "../../i18n";
import { MyGroups } from "./MyGroups";
import { useGroupOverviews } from "./useGroupOverviews";

/** The page at /groups. The "+" for Create group sits in its heading on wide screens. */
export function GroupListPage({
  createGroupButton,
  onUnauthenticated,
}: {
  createGroupButton: ReactNode;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const { state, reload } = useGroupOverviews(onUnauthenticated);
  return (
    <>
      <div className="page-heading">
        <h1>{m.groupsHeading}</h1>
        {createGroupButton}
      </div>
      <MyGroups state={state} onRetry={reload} />
    </>
  );
}
