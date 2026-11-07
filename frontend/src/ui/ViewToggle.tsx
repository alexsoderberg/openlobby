import type { ReactNode } from "react";

export type ViewToggleOption<T extends string> = {
  value: T;
  /** The accessible name and tooltip; the option itself shows only the icon. */
  label: string;
  icon: ReactNode;
};

/**
 * A pill of two options with a thumb that slides behind the selected icon. Native buttons keep Tab and Enter/Space;
 * the state is in aria-pressed and in the thumb's position, not in colour alone. `.view-switch` stays
 * on the root for the shared spacing rule.
 */
export function ViewToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly ViewToggleOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="view-switch view-toggle" role="group" aria-label={label}>
      <span className="view-toggle__thumb" aria-hidden="true" />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="view-toggle__option"
          aria-label={option.label}
          title={option.label}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="view-toggle__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const ListIcon = () => (
  <Icon>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </Icon>
);

export const CalendarIcon = () => (
  <Icon>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
);
