// Copied from shadcn/ui `button` (https://ui.shadcn.com/docs/components/button). Edited per ADR 0023 1b: class
// lists read our tokens, the variant names are the glossary's, no asChild and no class-variance-authority.
// ButtonLink is the same look on a link, for navigation that must stay a link (no asChild, so its own element).
// Type, hover and press live in global.css under [data-slot="button"]. Dark "Stage" look (ADR 0028 section 16.3):
// signal only on the primary, a control-line edge on the secondary, danger as edge and text.
import type { ComponentProps } from "react";
import { classNames } from "./classNames";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "icon";

const buttonVariants = {
  base: "relative isolate inline-flex items-center justify-center gap-(--space-2) min-h-(--size-button) pointer-coarse:min-h-(--size-tap) border rounded-(--radius) cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  variant: {
    primary:
      "border-(--color-signal) bg-(--color-signal) text-(--color-on-signal)",
    secondary:
      "border-(--color-control-line) bg-(--color-surface) text-(--color-text)",
    ghost: "border-transparent bg-transparent text-(--color-text)",
    danger: "border-(--color-danger) bg-transparent text-(--color-danger)",
  },
  size: {
    default: "py-(--space-0) px-(--space-3)",
    // Each size sets its own padding: one utility per property per state (ADR 0023, B2 amendment b).
    // Square under a mouse; on touch the label shows beside the icon (IconButton), so the button widens.
    icon: "w-(--size-button) p-(--space-0) pointer-coarse:w-auto pointer-coarse:px-(--space-3)",
  },
} satisfies {
  base: string;
  variant: Record<ButtonVariant, string>;
  size: Record<ButtonSize, string>;
};

type ButtonLook = { variant?: ButtonVariant; size?: ButtonSize };

/** The slot, variant and size that global.css styles, and the utility classes, shared by Button and ButtonLink. */
function buttonAttributes({
  variant = "primary",
  size = "default",
  className,
}: ButtonLook & { className?: string }) {
  return {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    className: classNames(
      buttonVariants.base,
      buttonVariants.variant[variant],
      buttonVariants.size[size],
      className,
    ),
  };
}

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"button"> & ButtonLook) {
  return (
    <button {...buttonAttributes({ variant, size, className })} {...props} />
  );
}

/** A link with the look of a Button: it navigates (a full page load, middle-click), so it stays an `a`. */
export function ButtonLink({
  className,
  variant,
  ...props
}: ComponentProps<"a"> & Pick<ButtonLook, "variant">) {
  return <a {...buttonAttributes({ variant, className })} {...props} />;
}
