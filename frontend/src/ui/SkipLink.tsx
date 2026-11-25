import { useMessages } from "../i18n";

/** The id of the page's `main`, the target of the skip link. That `main` needs `tabIndex={-1}` to take focus. */
export const MAIN_ID = "main";

/** "Skip to content": the first stop of the keyboard, hidden until focused, past the bar to `main` (WCAG 2.4.1). */
export function SkipLink() {
  const m = useMessages();
  return (
    <a
      className="visually-hidden skip-link"
      href={`#${MAIN_ID}`}
      onClick={(event) => {
        // Focus moves by script, so the address keeps no "#main" and the router sees no change.
        event.preventDefault();
        document.getElementById(MAIN_ID)?.focus();
      }}
    >
      {m.skipToContent}
    </a>
  );
}
