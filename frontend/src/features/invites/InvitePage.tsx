import type { InviteInfo } from "../../api";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert } from "../../ui/Alert";
import { ErrorAlert } from "../../ui/ErrorAlert";
import { INVITE_INVALID } from "./inviteErrors";
import { useInvite } from "./useInvite";
import type { JoinState } from "./useJoinInvite";

/**
 * The page behind an invite address. It shows the group's name only for a valid link. An invalid
 * link gives one page for every reason (ADR 0007), so the page cannot reveal which group it was.
 */
export function InvitePage({
  token,
  onGroupOpened,
  onUnauthenticated,
}: {
  token: string;
  onGroupOpened: (groupId: string) => void;
  onUnauthenticated: () => void;
}) {
  const m = useMessages();
  const { state, joinState, join, reload } = useInvite(
    token,
    onGroupOpened,
    onUnauthenticated,
  );

  switch (state.status) {
    case "loading":
    case "opening":
      return <p>{m.inviteLoading}</p>;
    case "error":
      return <ErrorAlert code={state.code} onRetry={reload} />;
    case "invalid":
      return <InvalidInvite />;
    case "invitation":
      return (
        <Invitation info={state.info} joinState={joinState} onJoin={join} />
      );
  }
}

function InvalidInvite() {
  const m = useMessages();
  return (
    <>
      <h1>{m.inviteInvalidHeading}</h1>
      <p>{toUserMessage(INVITE_INVALID)}</p>
      <a href="/">{m.backToStart}</a>
    </>
  );
}

function Invitation({
  info,
  joinState,
  onJoin,
}: {
  info: InviteInfo;
  joinState: JoinState;
  onJoin: () => void;
}) {
  const m = useMessages();
  const joining = joinState.status === "joining";

  return (
    <>
      <h1>{info.groupName}</h1>
      <p>{m.inviteIntro}</p>
      {joinState.status === "failed" && (
        <Alert>{toUserMessage(joinState.code)}</Alert>
      )}
      <button
        type="button"
        className="button"
        disabled={joining}
        onClick={onJoin}
      >
        {m.joinGroupSubmit}
      </button>
      <p role="status" className="status">
        {joining && m.joinGroupBusy}
      </p>
    </>
  );
}
