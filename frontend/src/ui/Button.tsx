// Copied from shadcn/ui `button` (https://ui.shadcn.com/docs/components/button). Edited per ADR 0023 1b: class
// lists read our tokens, the variant names are the glossary's, no asChild and no class-variance-authority.
// ButtonLink is the same look on a link, for navigation that must stay a link (no asChild, so its own element).
// Type, shadow, hover and press motion live in global.css under [data-slot="button"]; the light span holds the
// light that follows the pointer and the press shade.
import type { ComponentProps, PointerEvent } from "react";
import { classNames } from "./classNames";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "default" | "icon";

const buttonVariants = {
  base: "relative isolate inline-flex items-center justify-center gap-(--space-2) min-h-(--size-button) pointer-coarse:min-h-(--size-tap) border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
  variant: {
    primary:
      "border-(--color-accent) bg-(--color-accent) text-(--color-on-accent)",
    secondary:
      "border-(--color-border) bg-(--color-surface) text-(--color-text)",
    ghost: "border-transparent bg-transparent text-(--color-text)",
    danger: "border-(--color-danger) bg-transparent text-(--color-danger)",
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

const buttonLight = <span data-slot="button-light" aria-hidden="true" />;

export function Button({
  className,
  variant,
  size,
  onPointerMove,
  children,
  ...props
}: ComponentProps<"button"> & ButtonLook) {
  return (
    <button
      {...buttonAttributes({ variant, size, className })}
      onPointerMove={(event) => {
        placeLight(event);
        onPointerMove?.(event);
      }}
      {...props}
    >
      {buttonLight}
      {children}
    </button>
  );
}

/** A link with the look of a Button: it navigates (a full page load, middle-click), so it stays an `a`. */
export function ButtonLink({
  className,
  variant,
  onPointerMove,
  children,
  ...props
}: ComponentProps<"a"> & Pick<ButtonLook, "variant">) {
  return (
    <a
      {...buttonAttributes({ variant, className })}
      onPointerMove={(event) => {
        placeLight(event);
        onPointerMove?.(event);
      }}
      {...props}
    >
      {buttonLight}
      {children}
    </a>
  );
}

/** Puts the pointer position in two CSS variables, so the light moves by transform and never by layout. */
function placeLight(event: PointerEvent<HTMLElement>) {
  const button = event.currentTarget;
  const box = button.getBoundingClientRect();
  button.style.setProperty("--pointer-x", `${event.clientX - box.left}px`);
  button.style.setProperty("--pointer-y", `${event.clientY - box.top}px`);
}
