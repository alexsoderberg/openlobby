import { useRef, useState } from "react";
import type { ChangeResult } from "../api";
import { toUserMessage } from "../i18n";
import { Alert } from "./Alert";
import { Button } from "./Button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./Dialog";
import { Icon, type IconName } from "./Icon";

/**
 * A modal confirmation on Radix AlertDialog (ADR 0023 point 5): the page behind is inert, and Keep or
 * Escape close it; a click outside does nothing. Keep gets the first focus, so Enter right after opening does not
 * run the action. `onConfirm` resolves to the error code of a refusal, which stays in the dialog, where it is read; a success closes it. The
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
  const keepRef = useRef<HTMLButtonElement>(null);
  // Read once, before Radix moves focus to Keep. No Radix Trigger opened it, so Radix has nothing to return to.
  const [opener] = useState(() => document.activeElement);

  // While the action runs the dialog stays, so the owner never misses the outcome of a change it asked for.
  const dismiss = () => {
    if (!running) setOpen(false);
  };

  async function confirm() {
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
        // Radix would focus the first button, the action; Keep goes first (ADR 0023 Amendment 2026-11-19).
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          keepRef.current?.focus();
        }}
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
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            disabled={busy || running}
            onClick={confirm}
          >
            <Icon name={submitIcon} />
            {submitLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            ref={keepRef}
            disabled={running}
            onClick={dismiss}
          >
            <Icon name="close" />
            {keepLabel}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
