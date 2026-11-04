import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

const NAVIGATE_EVENT = "app:navigate";
const API_PREFIX = "/api/";

/** Runs a synchronous screen update inside a view transition, or plainly when the browser or the user opts out of motion. */
export function withTransition(update: () => void) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !document.startViewTransition) return update();
  document.startViewTransition(update);
}

/** Moves to another page of the app without a page load. */
export function navigate(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

function isAppLink(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href") ?? "";
  return (
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.startsWith(API_PREFIX) &&
    !anchor.target &&
    !anchor.hasAttribute("download")
  );
}

function isPlainClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
  );
}

/** The current address path. Link clicks, `navigate` and back/forward change it, each through a view transition. */
export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const sync = () =>
      withTransition(() =>
        flushSync(() => setPathname(window.location.pathname)),
      );
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element).closest("a");
      if (!anchor || !isPlainClick(event) || !isAppLink(anchor)) return;
      event.preventDefault();
      navigate(anchor.getAttribute("href") as string);
    };
    window.addEventListener("popstate", sync);
    window.addEventListener(NAVIGATE_EVENT, sync);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(NAVIGATE_EVENT, sync);
      document.removeEventListener("click", onClick);
    };
  }, []);

  return pathname;
}
