import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import { Tooltip } from "./Tooltip";

/**
 * An icon-only button for secondary actions (ADR 0021), never for a destructive one. One `label` is both the
 * accessible name and the tooltip; on touch screens the label is shown beside the icon instead (global.css).
 */
export function IconButton({
  icon,
  label,
  type = "button",
  ...buttonProps
}: {
  icon: IconName;
  label: string;
} & Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "type" | "disabled"
>) {
  return (
    <Tooltip label={label}>
      <button
        {...buttonProps}
        type={type}
        className="button-ghost button--icon"
        aria-label={label}
      >
        <Icon name={icon} />
        <span className="button__label">{label}</span>
      </button>
    </Tooltip>
  );
}
