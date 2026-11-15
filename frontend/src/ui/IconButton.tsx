import type { ButtonHTMLAttributes } from "react";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { Tooltip } from "./Tooltip";

/**
 * An icon-only button for secondary actions (ADR 0021), never for a destructive one. One `label` is both the
 * accessible name and the tooltip; on touch screens the label is shown beside the icon instead.
 * In a list of like rows, `subject` names the row in the accessible name ("Edit, Chess"); the name still starts
 * with the visible label (WCAG 2.5.3).
 */
export function IconButton({
  icon,
  label,
  subject,
  type = "button",
  ...buttonProps
}: {
  icon: IconName;
  label: string;
  subject?: string;
} & Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "type" | "disabled"
>) {
  return (
    <Tooltip label={label}>
      <Button
        {...buttonProps}
        type={type}
        variant="ghost"
        size="icon"
        aria-label={subject === undefined ? label : `${label}, ${subject}`}
      >
        <Icon name={icon} />
        <span className="not-pointer-coarse:hidden">{label}</span>
      </Button>
    </Tooltip>
  );
}
