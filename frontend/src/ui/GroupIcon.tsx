import { Avatar } from "./Avatar";

/** A group as a round link with its initials. The accessible name is the group name. */
export function GroupIcon({
  name,
  href,
  active,
}: {
  name: string;
  href: string;
  active: boolean;
}) {
  return (
    <a
      className="group-icon"
      href={href}
      aria-label={name}
      title={name}
      aria-current={active ? "page" : undefined}
    >
      <Avatar name={name} />
    </a>
  );
}
