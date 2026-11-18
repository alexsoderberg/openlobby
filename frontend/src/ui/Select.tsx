// Structure from shadcn/ui `select` (https://ui.shadcn.com/docs/components/select) on Radix Select (ADR 0027).
// Edited per ADR 0023 point 2: class lists read our tokens; type, shadow and motion live in global.css under
// [data-slot="select-*"], and the phone sheet is the `phone:` variant plus one wrapper rule there.
import * as RadixSelect from "@radix-ui/react-select";
import {
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
} from "react";
import { classNames } from "./classNames";
import { Icon } from "./Icon";

export type DropdownOption = {
  /** The saved value; "" is a valid choice (no game, no mode, no genre). */
  value: string;
  label: string;
  /** A decorative visual before the label, e.g. a game logo. */
  leading?: ReactNode;
  /** Shown, not choosable: a saved value that is no longer offered. */
  disabled?: boolean;
};

/** Radix forbids "" as an item value, so the empty choice travels as this. No saved value can equal it. */
const NO_CHOICE = "__none__";
const toRadix = (value: string) => (value === "" ? NO_CHOICE : value);
const fromRadix = (value: string) => (value === NO_CHOICE ? "" : value);

/** Px between the field and the panel, and between the panel and the window edges. Radix takes numbers, so
 *  these repeat --space-1 and --space-2. */
const PANEL_GAP = 4;
const WINDOW_MARGIN = 8;

const TABBABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';

/**
 * The control Tab reaches from `trigger`, `step` +1 or -1. Inside a dialog (a popover form) the order is the
 * dialog's own and wraps at its ends, as its focus trap does; elsewhere it is the page's. The list's own rows
 * have tabIndex -1, so they are left out.
 */
function nextInTabOrder(trigger: HTMLElement, step: number) {
  const dialog = trigger.closest<HTMLElement>('[role="dialog"]');
  const order = Array.from(
    (dialog ?? document).querySelectorAll<HTMLElement>(TABBABLE),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      !element.closest("[hidden]") &&
      element.checkVisibility?.({ visibilityProperty: true }) !== false,
  );
  const index = order.indexOf(trigger) + step;
  return dialog ? order.at(index % order.length) : order[index];
}

const selectVariants = {
  trigger:
    "inline-flex w-full items-center gap-(--space-2) min-h-(--size-button) pointer-coarse:min-h-(--size-tap) px-(--space-2) border border-(--color-muted) rounded-(--radius-control) bg-(--color-surface) text-(--color-text) cursor-pointer enabled:hover:border-(--color-text) aria-expanded:border-(--color-accent) data-placeholder:text-(--color-muted) disabled:cursor-not-allowed disabled:opacity-50",
  content:
    "z-(--z-dropdown-list) min-w-(--radix-select-trigger-width) max-h-(--radix-select-content-available-height) p-(--space-1) border border-(--color-accent-line) rounded-(--radius-panel) bg-(--color-bg-raised) text-(--color-text) phone:fixed phone:inset-x-(--space-0) phone:bottom-(--space-0) phone:w-full phone:max-h-(--size-sheet-max) phone:rounded-b-(--space-0) phone:pb-(--sheet-safe-bottom)",
  item: "flex items-center gap-(--space-2) py-(--space-2) px-(--space-3) phone:min-h-(--size-tap) rounded-(--radius-control) cursor-pointer data-highlighted:bg-(--color-accent-tint) data-disabled:cursor-not-allowed data-disabled:opacity-50",
  selected: "text-(--color-accent)",
};

/**
 * A dropdown list: a field with the value and a chevron that opens a panel of options, a bottom sheet on phones
 * (REQ-0027). Radix gives the select-only combobox keyboard and screen reader semantics; Tab is ours, since
 * Radix keeps focus on Tab. With `name`, a hidden input carries the real value to the form.
 */
export function Select({
  id,
  ref,
  value,
  onValueChange,
  options,
  placeholder,
  name,
  disabled,
  reportRepick,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
}: {
  /** On the field; the label's htmlFor points at it. */
  id: string;
  ref?: Ref<HTMLButtonElement>;
  value: string;
  onValueChange: (value: string) => void;
  options: DropdownOption[];
  /** Shown while `value` matches no option; not an option. */
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  /** Calls `onValueChange` also when the shown value is picked again, for a field that shows a default until a
   *  person picks (ADR 0024 section 4). Radix reports only changes. */
  reportRepick?: boolean;
  /** The error look and state, as on the other fields; the form shows the error text. */
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  // +1 or -1 while the list closes on Tab or Shift+Tab, so focus moves on instead of back to the field.
  const tabStep = useRef(0);
  // Set while the shown option is being picked; the list then closes without a change from Radix.
  const repicked = useRef(false);
  // Radix prevents the pointer up that opened the list, and then picks nothing.
  const markRepick = (event: SyntheticEvent) => {
    if (!event.defaultPrevented) repicked.current = true;
  };

  function focusAfterTab(event: Event) {
    const step = tabStep.current;
    tabStep.current = 0;
    const trigger = document.getElementById(id);
    const next = step && trigger && nextInTabOrder(trigger, step);
    if (!next) return;
    event.preventDefault();
    next.focus();
  }

  return (
    <RadixSelect.Root
      // "" with no empty option is Radix's own "nothing chosen", which shows the placeholder.
      value={
        options.some((option) => option.value === "") ? toRadix(value) : value
      }
      onValueChange={(next) => onValueChange(fromRadix(next))}
      open={open}
      onOpenChange={(next) => {
        if (!next && reportRepick && repicked.current) onValueChange(value);
        repicked.current = false;
        setOpen(next);
      }}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        ref={ref}
        id={id}
        data-slot="select-trigger"
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={selectVariants.trigger}
      >
        {/* Radix's Value drops className, so the box that pushes the chevron to the end is ours. */}
        <span className="flex-1 min-w-(--space-0) truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon className="shrink-0 text-(--color-muted)">
          <Icon name="chevronDown" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      {name && <input type="hidden" name={name} value={value} />}
      <RadixSelect.Portal>
        <RadixSelect.Content
          data-slot="select-content"
          position="popper"
          sideOffset={PANEL_GAP}
          collisionPadding={WINDOW_MARGIN}
          className={selectVariants.content}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            tabStep.current = event.shiftKey ? -1 : 1;
            setOpen(false);
          }}
          onCloseAutoFocus={focusAfterTab}
          onEscapeKeyDown={() => {
            repicked.current = false;
          }}
        >
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={toRadix(option.value)}
                textValue={option.label}
                disabled={option.disabled}
                // The ways Radix picks an item; a pick of another option is a change Radix reports itself.
                {...(option.value === value && {
                  onPointerUp: markRepick,
                  onClick: markRepick,
                  onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ")
                      markRepick(event);
                  },
                })}
                data-slot="select-item"
                className={classNames(
                  selectVariants.item,
                  option.value === value ? selectVariants.selected : undefined,
                )}
              >
                <RadixSelect.ItemText>
                  {/* Its own box, so the label stays plain text and still truncates in the field. */}
                  {option.leading && (
                    <span className="inline-flex align-middle me-(--space-2)">
                      {option.leading}
                    </span>
                  )}
                  {option.label}
                </RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ms-auto">
                  <Icon name="selected" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
