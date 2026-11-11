import type { ComponentProps } from "react";
import { Icon } from "./Icon";

/** A native select with the project's chevron. The select keeps the keyboard, screen readers and mobile pickers. */
export function Select(props: ComponentProps<"select">) {
  return (
    <span className="select">
      <select {...props} />
      <Icon name="chevronDown" className="select__chevron" />
    </span>
  );
}
