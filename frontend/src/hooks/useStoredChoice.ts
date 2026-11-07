import { useState } from "react";

/** Storage is per browser and may be missing or refused, so every access is guarded and the fallback applies. */
function read<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): T {
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(key);
  } catch {
    // Browser refuses storage: the default applies (REQ-0012, Amendment 2026-11-07).
  }
  return choices.find((choice) => choice === saved) ?? fallback;
}

/**
 * A choice kept in this browser. It is read once, during the first render, so the saved view never
 * flashes behind the default. If saving fails the choice still holds for the session.
 */
export function useStoredChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): [T, (choice: T) => void] {
  const [choice, setChoice] = useState(() => read(key, choices, fallback));
  const choose = (next: T) => {
    setChoice(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // Browser refuses storage: the choice holds for this session and the default applies on the next load (REQ-0012, Amendment 2026-11-07).
    }
  };
  return [choice, choose];
}
