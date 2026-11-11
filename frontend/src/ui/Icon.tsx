import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  House,
  Link,
  List,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Shield,
  Trash,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * The only map from our icon names to the icon library (ADR 0021): swapping the library rewrites this file alone.
 * Action icons are named after the action, so one action has one icon across the app.
 */
const icons = {
  back: ArrowLeft,
  calendar: Calendar,
  chevronDown: ChevronDown,
  close: X,
  copy: Copy,
  edit: Pencil,
  forward: ArrowRight,
  groups: Users,
  home: House,
  invite: Link,
  join: UserPlus,
  leave: UserMinus,
  list: List,
  logIn: LogIn,
  logOut: LogOut,
  makeAdmin: Shield,
  plus: Plus,
  remove: Trash,
  retry: RotateCcw,
  revoke: Ban,
  save: Check,
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
