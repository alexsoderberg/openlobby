import { Icon, type IconName } from "./Icon";

export type ViewToggleOption<T extends string> = {
  value: T;
  /** The accessible name and tooltip; the option itself shows only the icon. */
  label: string;
  icon: IconName;
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
          <Icon name={option.icon} className="view-toggle__icon" />
        </button>
      ))}
    </div>
  );
}
