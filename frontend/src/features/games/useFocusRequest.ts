import { useEffect, useRef } from "react";

/**
 * Focus for an element that exists only after the next render (a row just added, or the button that follows a
 * removal). Call the returned function with the element's ID in the event handler; the focus moves once `change`
 * has been rendered.
 */
export function useFocusRequest(change: unknown) {
  const target = useRef<string>(undefined);
  useEffect(() => {
    if (target.current === undefined) return;
    document.getElementById(target.current)?.focus();
    target.current = undefined;
  }, [change]);
  return (elementId: string) => {
    target.current = elementId;
  };
}
