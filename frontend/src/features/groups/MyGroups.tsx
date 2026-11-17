import type { CSSProperties } from "react";
import type { LoadView } from "../../hooks";
import { useMessages } from "../../i18n";
import { ErrorAlert, Panel } from "../../ui";
import { GroupCard } from "./GroupCard";
import type { GroupOverviews } from "./useGroupOverviews";

/** The Group list: a grid of Group cards in the server's order. Groups are created from the "+" in the app shell. */
export function MyGroups({
  state,
  onRetry,
}: {
  state: LoadView<GroupOverviews>;
  onRetry: () => void;
}) {
  const m = useMessages();
  if (state.status === "loaded" && state.value.groups.length > 0)
    return (
      <ul className="group-cards" role="list">
        {state.value.groups.map((group, index) => (
          // The index orders the cards' fade-up in global.css (signature: groups).
          <li key={group.id} style={{ "--card-index": index } as CSSProperties}>
            <GroupCard group={group} now={state.value.loadedAt} />
          </li>
        ))}
      </ul>
    );
  return (
    <Panel>
      {state.status === "loading" && <p role="status">{m.groupsLoading}</p>}
      {state.status === "error" && (
        <ErrorAlert code={state.code} onRetry={onRetry} />
      )}
      {state.status === "loaded" && <p>{m.groupsEmpty}</p>}
    </Panel>
  );
}
