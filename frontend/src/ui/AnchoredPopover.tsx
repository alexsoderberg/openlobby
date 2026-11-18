// On Radix Popover (ADR 0023 Amendment 2026-11-17). Class lists read our tokens; type, shadow and motion live in
// global.css under [data-slot="anchored-popover"].
import * as RadixPopover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

/** Px between the trigger and the panel, and between the panel and the window edges. Radix takes numbers, so
 *  these repeat --space-1 and --space-2. */
const PANEL_GAP = 4;
const WINDOW_MARGIN = 8;

// border-(length:--space-0), not border-0: class lists read tokens only (uiClasses.test.ts, ADR 0023 Amendment
// 2026-11-16 B2 a).
const popoverVariants = {
  trigger:
    "inline-flex items-center p-(--space-0) border-(length:--space-0) bg-transparent text-(--color-text) cursor-pointer",
  content:
    "z-(--z-popover) w-max max-w-(--width-popover) phone:max-w-(--radix-popover-content-available-width) py-(--space-2) px-(--space-3) border border-(--color-accent-line) rounded-(--radius-popover) bg-(--color-bg-raised) text-(--color-text) wrap-break-word",
};

/**
 * A panel beside its trigger that opens on click, tap, Enter or Space; Escape or a click outside closes it and
 * focus returns to the trigger. Not modal: no scrim, no focus trap. `triggerLabel` is the trigger's full
 * accessible name; `children` is what the trigger shows.
 */
export function AnchoredPopover({
  triggerLabel,
  content,
  children,
}: {
  triggerLabel: string;
  content: ReactNode;
  children: ReactNode;
}) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger
        data-slot="anchored-popover-trigger"
        aria-label={triggerLabel}
        className={popoverVariants.trigger}
      >
        {children}
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          data-slot="anchored-popover"
          side="top"
          align="start"
          sideOffset={PANEL_GAP}
          collisionPadding={WINDOW_MARGIN}
          className={popoverVariants.content}
        >
          {content}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
