import { useRef, useState, type MouseEvent } from "react";
import type { ChangeResult } from "../api";
import { toUserMessage } from "../i18n";
import { Alert } from "./Alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./Dialog";
import { Icon, type IconName } from "./Icon";

/**
 * A modal confirmation on Radix AlertDialog (ADR 0023 point 5): the page behind is inert, and Keep, Escape or the
 * overlay close it. Keep gets the first focus, so Enter right after opening does not run the action. `onConfirm`
 * resolves to the error code of a refusal, which stays in the dialog, where it is read; a success closes it. The
 * dialog keeps its own open state so its exit motion can run: `onClose` comes after the exit, with `confirmed`
 * true after a success, and the owner removes the dialog and acts there. Focus is back on the opener by then, if
 * it is still on the page. `danger` marks a destructive action (ADR 0021).
 */
export function ConfirmDialog({
  heading,
  body,
  submitLabel,
  submitIcon,
  danger = false,
  keepLabel,
  busy,
  onConfirm,
  onClose,
}: {
  heading: string;
  body: string;
  submitLabel: string;
  submitIcon: IconName;
  danger?: boolean;
  keepLabel: string;
  busy: boolean;
  onConfirm: () => ChangeResult;
  onClose: (confirmed: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [errorCode, setErrorCode] = useState<string>();
  const confirmed = useRef(false);
  // Read once, before Radix moves focus to Keep. No Radix Trigger opened it, so Radix has nothing to return to.
  const [opener] = useState(() => document.activeElement);

  // While the action runs the dialog stays, so the owner never misses the outcome of a change it asked for.
  const dismiss = () => {
    if (!running) setOpen(false);
  };

  async function confirm(event: MouseEvent) {
    event.preventDefault(); // Action closes by default; only a success closes this dialog.
    setRunning(true);
    try {
      const code = await onConfirm();
      setErrorCode(code);
      confirmed.current = code === undefined;
      if (confirmed.current) setOpen(false);
    } finally {
      setRunning(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => next || dismiss()}>
      <AlertDialogContent
        onOverlayClick={dismiss}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener instanceof HTMLElement && opener.isConnected) {
            opener.focus();
          }
          onClose(confirmed.current);
        }}
      >
        <AlertDialogTitle>{heading}</AlertDialogTitle>
        <AlertDialogDescription>{body}</AlertDialogDescription>
        {errorCode !== undefined && <Alert>{toUserMessage(errorCode)}</Alert>}
        <div className="form-actions">
          <AlertDialogAction
            variant={danger ? "danger" : "primary"}
            disabled={busy || running}
            onClick={confirm}
          >
            <Icon name={submitIcon} />
            {submitLabel}
          </AlertDialogAction>
          <AlertDialogCancel disabled={running}>
            <Icon name="close" />
            {keepLabel}
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
