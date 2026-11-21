// The one wrapper of sonner (ADR 0023 point 4). Callers pass text already translated (ADR 0013). Type and motion
// live in global.css under [data-sonner-toast]; the class list reads our tokens.
import { useEffect, type FocusEvent } from "react";
import { Toaster as SonnerToaster, toast } from "sonner";

export const TOAST_DURATION_MS = 4000;

// sonner applies a string offset as a CSS length. Phones use the same value: sonner's own phone switch (600px)
// is not the app's (47.5rem), so global.css decides through --toast-bottom.
const OFFSET = { bottom: "var(--toast-bottom)", right: "var(--space-3)" };

const TOAST_CLASS =
  "flex items-center gap-(--space-2) px-(--space-3) py-(--space-2) border border-(--color-rule-strong) rounded-(--radius) bg-(--color-raised) text-(--color-text)";

const REGION = "[data-toast-region]";

/**
 * Shows one confirmation; a toast already on screen is dismissed, so only one is there and read (REQ-0022). With
 * keyboard focus already in the region (Alt+T) it is held from the start, as the region holds its toasts.
 * Focus on the dismissed toast does not count: that toast leaves the page, and focus with it, with no blur to end
 * the hold.
 */
export function showToast(message: string) {
  const focus = document.activeElement;
  const held =
    focus?.closest(REGION) != null &&
    focus.closest("[data-sonner-toast]") == null;
  toast.dismiss();
  toast(message, held ? { duration: Infinity } : undefined);
}

/** The toast region, mounted once in the app root. */
export function Toaster() {
  // sonner's store outlives the region and replays its toasts to the next one mounted; they leave with this one.
  useEffect(() => () => void toast.dismiss(), []);
  // sonner pauses on the pointer only. Keyboard focus in the region holds the toasts too (REQ-0022): they get no
  // end while focus is inside, and their full duration again once it leaves. sonner keeps the time left in its own
  // state and resets it when the duration changes, so the timer restarts rather than continues. Only toasts that are
  // not dismissed are held: touching a dismissed one would bring it back.
  const hold = (duration: number) =>
    toast
      .getToasts()
      .forEach(
        (shown) =>
          "title" in shown && toast(shown.title, { id: shown.id, duration }),
      );
  const crossesRegion = (event: FocusEvent) =>
    !event.currentTarget.contains(event.relatedTarget);

  return (
    <div
      data-toast-region=""
      onFocus={(event) => crossesRegion(event) && hold(Infinity)}
      onBlur={(event) => crossesRegion(event) && hold(TOAST_DURATION_MS)}
    >
      <SonnerToaster
        position="bottom-right"
        expand={false}
        visibleToasts={1}
        duration={TOAST_DURATION_MS}
        offset={OFFSET}
        mobileOffset={OFFSET}
        toastOptions={{ unstyled: true, className: TOAST_CLASS }}
      />
    </div>
  );
}
