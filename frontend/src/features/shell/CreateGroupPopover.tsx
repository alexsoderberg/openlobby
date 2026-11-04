import type { CSSProperties, ReactNode, RefObject } from "react";
import { useMessages } from "../../i18n";

/**
 * The frame the Create group form grows out of. The outer box never moves, so the "+" can be measured against
 * it; only the card inside scales, from the "+" centre, with transform and opacity alone. The scrim closes
 * the form on a tap outside. Closed, the frame is hidden from sight and from the keyboard (see global.css).
 */
export function CreateGroupPopover({
  open,
  origin,
  frameRef,
  onClose,
  children,
}: {
  open: boolean;
  origin: { x: number; y: number };
  frameRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const m = useMessages();
  return (
    <>
      <div
        className="scrim"
        data-open={open}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={frameRef}
        className="create-popover"
        data-open={open}
        role="dialog"
        aria-label={m.createGroupHeading}
        aria-hidden={open ? undefined : true}
        style={
          {
            "--origin-x": `${origin.x}px`,
            "--origin-y": `${origin.y}px`,
          } as CSSProperties
        }
      >
        <div className="create-popover__card">{children}</div>
      </div>
    </>
  );
}
