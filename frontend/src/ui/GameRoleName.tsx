import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * A game role's name with its role icon before it (REQ-0023). The icon is decorative and at the text size, so
 * the name carries the meaning and the icon is never smaller than the text; no icon for `null` or `none`.
 */
export function GameRoleName({
  icon,
  children,
}: {
  icon?: IconName | "none" | null;
  children: ReactNode;
}) {
  return (
    <span
      data-slot="game-role-name"
      className="inline-flex items-center gap-(--space-1)"
    >
      {icon && icon !== "none" && <Icon name={icon} className="flex-none" />}
      {children}
    </span>
  );
}
