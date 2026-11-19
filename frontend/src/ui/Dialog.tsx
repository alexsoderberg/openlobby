// Copied from shadcn/ui `alert-dialog` (https://ui.shadcn.com/docs/components/alert-dialog) on Radix AlertDialog,
// trimmed to Content, Title, Description, Action and Cancel (ADR 0023 point 5). Edited per ADR 0023 point 2: class
// lists read our tokens; type and motion live in global.css under [data-slot="alert-dialog-*"]. Action and Cancel
// render our Button, since Button has no asChild of its own. The overlay closes the dialog (ADR 0023 point 5), which
// Radix's alert dialog does not do by itself, so Content takes `onOverlayClick`.
import * as RadixAlertDialog from "@radix-ui/react-alert-dialog";
import type { ComponentProps } from "react";
import { Button } from "./Button";
import { classNames } from "./classNames";

const dialogVariants = {
  overlay: "fixed inset-(--space-0) z-(--z-dialog) bg-(--color-frost)",
  // Centred by auto margins at its own size, as the native dialog was, so a transform is free for the motion.
  content:
    "fixed inset-(--space-0) z-(--z-dialog) m-auto w-fit h-fit max-w-(--width-dialog) max-h-(--height-dialog) overflow-y-auto p-(--space-4) border border-(--color-border) rounded-(--radius-panel) bg-(--color-bg-raised) text-(--color-text)",
};

export const AlertDialog = RadixAlertDialog.Root;

export function AlertDialogContent({
  className,
  onOverlayClick,
  ...props
}: ComponentProps<typeof RadixAlertDialog.Content> & {
  onOverlayClick?: () => void;
}) {
  return (
    <RadixAlertDialog.Portal>
      <RadixAlertDialog.Overlay
        data-slot="alert-dialog-overlay"
        className={dialogVariants.overlay}
        onClick={onOverlayClick}
      />
      <RadixAlertDialog.Content
        data-slot="alert-dialog-content"
        className={classNames(dialogVariants.content, className)}
        {...props}
      />
    </RadixAlertDialog.Portal>
  );
}

export function AlertDialogTitle(
  props: ComponentProps<typeof RadixAlertDialog.Title>,
) {
  return <RadixAlertDialog.Title data-slot="alert-dialog-title" {...props} />;
}

export function AlertDialogDescription(
  props: ComponentProps<typeof RadixAlertDialog.Description>,
) {
  return (
    <RadixAlertDialog.Description
      data-slot="alert-dialog-description"
      {...props}
    />
  );
}

export function AlertDialogAction(props: ComponentProps<typeof Button>) {
  return (
    <RadixAlertDialog.Action asChild>
      <Button {...props} />
    </RadixAlertDialog.Action>
  );
}

export function AlertDialogCancel({
  variant = "secondary",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <RadixAlertDialog.Cancel asChild>
      <Button variant={variant} {...props} />
    </RadixAlertDialog.Cancel>
  );
}
