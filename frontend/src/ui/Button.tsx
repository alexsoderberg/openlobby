// Copied from shadcn/ui `button` (https://ui.shadcn.com/docs/components/button). Edited per ADR 0023 1b: class
// lists read our tokens, the variant names are the glossary's, no asChild and no class-variance-authority.
// Type, shadow, hover and press motion live in global.css under [data-slot="button"].
import type { ComponentProps } from "react";
import { classNames } from "./classNames";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "icon";

const buttonVariants = {
  base: "relative inline-flex items-center justify-center gap-(--space-2) min-h-(--size-button) pointer-coarse:min-h-(--size-button-touch) border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  variant: {
    primary:
      "overflow-hidden border-(--color-accent) bg-(--color-accent) text-(--color-on-accent)",
    secondary:
      "isolate border-(--color-border) bg-(--color-surface) text-(--color-text)",
    ghost: "isolate border-transparent bg-transparent text-(--color-text)",
    danger:
      "isolate border-(--color-danger) bg-transparent text-(--color-danger)",
  },
  size: {
    default: "rounded-(--radius-control) py-(--space-0) px-(--space-3)",
    // Each size sets its own radius and padding: one utility per property per state (ADR 0023, B2 amendment b).
    // Round under a mouse; on touch the label shows beside the icon (IconButton), so the button becomes a pill.
    icon: "w-(--size-button) rounded-(--radius-chip) p-(--space-0) pointer-coarse:w-auto pointer-coarse:px-(--space-3)",
  },
} satisfies {
  base: string;
  variant: Record<ButtonVariant, string>;
  size: Record<ButtonSize, string>;
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={classNames(
        buttonVariants.base,
        buttonVariants.variant[variant],
        buttonVariants.size[size],
        className,
      )}
      {...props}
    />
  );
}
