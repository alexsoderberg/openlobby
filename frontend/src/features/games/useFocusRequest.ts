import { useEffect, useRef } from "react";

/**
 * Focus for an element that exists only after the next render (a row just added, the button that follows a
 * removal, or the mode view just opened). Call the returned function with the element's ID in the event handler;
 * the focus moves once the change has been rendered.
 */
export function useFocusRequest() {
  const target = useRef<string>(undefined);
  // No dependencies: the change may be in the draft or in which mode is open, and the check is cheap.
  useEffect(() => {
    if (target.current === undefined) return;
    document.getElementById(target.current)?.focus();
    target.current = undefined;
  });
  return (elementId: string) => {
    target.current = elementId;
  };
}
