import { useCallback, useState } from "react";
import { inviteUrl } from "./inviteLink";

type CopyOutcome = "copied" | "failed";

/** `attempt` changes on every copy, so the confirmation can animate again even when the text is the same. */
type CopyResult = { outcome: CopyOutcome; attempt: number };

/** Copies the full address of a link. A browser that refuses leaves the address selectable by hand. */
export function useCopyInviteLink() {
  const [result, setResult] = useState<CopyResult>();

  const record = useCallback((outcome: CopyOutcome) => {
    setResult((previous) => ({
      outcome,
      attempt: (previous?.attempt ?? 0) + 1,
    }));
  }, []);

  const copy = useCallback(
    async (token: string) => {
      try {
        await navigator.clipboard.writeText(inviteUrl(token));
        record("copied");
      } catch {
        record("failed");
      }
    },
    [record],
  );

  return { result, copy };
}
