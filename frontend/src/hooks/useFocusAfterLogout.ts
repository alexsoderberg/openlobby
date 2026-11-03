import { useEffect, type RefObject } from "react";

/** After a logout the button the user pressed is gone, so focus moves to the heading (WCAG 2.4.3). */
export function useFocusAfterLogout(
  headingRef: RefObject<HTMLElement | null>,
  afterLogout: boolean,
) {
  useEffect(() => {
    if (afterLogout) headingRef.current?.focus();
  }, [afterLogout, headingRef]);
}
