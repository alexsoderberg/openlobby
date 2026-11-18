import type { CSSProperties } from "react";

/**
 * A bar that fills to value out of max. It is announced as a meter, so the number reaches
 * assistive technology, not only the picture. Inside a scroll reveal it fills from 0 (see `.meter`).
 */
export function Meter({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  return (
    <div
      className="meter"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      style={{ "--meter-value": value / max } as CSSProperties}
    >
      <span />
    </div>
  );
}
