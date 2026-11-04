import { useEffect, useState } from "react";
import { readLoginError, withoutLoginError } from "../features/login";
import type { LoginErrorCode } from "../i18n";

export type EntryLocation = {
  returnTo: string;
  loginError?: LoginErrorCode;
};

/** Reads the address once. The login result is then removed from the address bar, so a reload does not repeat it. */
export function useEntryLocation(): EntryLocation {
  const [entry] = useState<EntryLocation>(() => {
    const { pathname, search } = window.location;
    return {
      returnTo: pathname + withoutLoginError(search),
      loginError: readLoginError(search),
    };
  });

  useEffect(() => {
    if (entry.loginError) window.history.replaceState(null, "", entry.returnTo);
  }, [entry]);

  return entry;
}
