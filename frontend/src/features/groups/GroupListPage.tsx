import { useMessages } from "../../i18n";
import { MyGroups } from "./MyGroups";
import { useGroupOverviews } from "./useGroupOverviews";

/** The page at /groups. */
export function GroupListPage({
  onUnauthenticated,
}: {
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const { state, reload } = useGroupOverviews(onUnauthenticated);
  return (
    <>
      <h1>{m.groupsHeading}</h1>
      <MyGroups state={state} onRetry={reload} />
    </>
  );
}
