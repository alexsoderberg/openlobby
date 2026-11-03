import { useCallback, useState } from "react";
import { inviteUrl } from "./inviteLink";

type CopyState = "idle" | "copied" | "failed";

/** Copies the full address of a link. A browser that refuses leaves the address selectable by hand. */
export function useCopyInviteLink() {
  const [state, setState] = useState<CopyState>("idle");

  const copy = useCallback(async (token: string) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setState("copied");
    } catch {
      setState("failed");
    }
  }, []);

  return { state, copy };
}
