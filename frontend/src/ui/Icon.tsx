import {
  Calendar,
  ChevronDown,
  Copy,
  House,
  List,
  Pencil,
  Plus,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

/** The only map from our icon names to the icon library (ADR 0021): swapping the library rewrites this file alone. */
const icons = {
  calendar: Calendar,
  chevronDown: ChevronDown,
  copy: Copy,
  edit: Pencil,
  groups: Users,
  home: House,
  list: List,
  plus: Plus,
  you: User,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

const STROKE_WIDTH = 1.8;

/** A decorative icon at the text size in the text colour; the control around it carries the name. */
export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  const Glyph = icons[name];
  return (
    <Glyph
      className={className}
      size="1em"
      strokeWidth={STROKE_WIDTH}
      aria-hidden="true"
      focusable="false"
    />
  );
}
