import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { beginPageLoads, pageLoadsSettled } from "../hooks";

const NAVIGATE_EVENT = "app:navigate";
const API_PREFIX = "/api/";
/** How long a transition holds the old page for the new page's data before animating anyway. */
const PAGE_LOAD_WAIT_MS = 400;

/**
 * Runs a screen update inside a view transition, or plainly when the browser or the user opts out of motion.
 * The transition waits for the new page's first load, so it animates to the loaded page instead of a loading one.
 */
function withTransition(update: () => void) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !document.startViewTransition) return update();
  document.startViewTransition(async () => {
    beginPageLoads();
    update();
    await pageLoadsSettled(PAGE_LOAD_WAIT_MS);
  });
}

/** Moves to another page of the app without a page load. */
export function navigate(path: string) {
  if (path === window.location.pathname + window.location.search) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

function isAppLink(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute("href") ?? "";
  return (
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.startsWith("/\\") &&
    !href.startsWith(API_PREFIX) &&
    !anchor.getAttribute("target") &&
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
  const [current, setPathname] = useState(() => window.location.pathname);
  const pathname = useRef(current);

  useEffect(() => {
    const sync = (event: Event) => {
      if (window.location.pathname === pathname.current) return;
      pathname.current = window.location.pathname;
      withTransition(() => {
        flushSync(() => setPathname(pathname.current));
        // Back and forward keep the scroll the browser restores; a new page starts at the top.
        if (event.type === NAVIGATE_EVENT) window.scrollTo(0, 0);
      });
    };
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

  return current;
}
