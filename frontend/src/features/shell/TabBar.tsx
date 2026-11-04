import type { ReactNode } from "react";
import { useMessages } from "../../i18n";
import { GROUPS_PATH } from "../groups";
import { PROFILE_PATH } from "../profile";
import { HOME_PATH, type ActiveNav } from "./activeNav";
import { GroupsIcon, HomeIcon, YouIcon } from "./icons";

function Tab({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <a className="tab" href={href} aria-current={active ? "page" : undefined}>
      {children}
      {label}
    </a>
  );
}

/** Phones: three equal columns, Home, Groups, You. The "+" floats above it (see AppShell). */
export function TabBar({ active }: { active: ActiveNav }) {
  const m = useMessages();
  return (
    <nav className="tab-bar" aria-label={m.shell.mainNav}>
      <Tab
        href={HOME_PATH}
        label={m.shell.home}
        active={active.section === "home"}
      >
        <HomeIcon />
      </Tab>
      <Tab
        href={GROUPS_PATH}
        label={m.shell.groups}
        active={active.section === "groups"}
      >
        <GroupsIcon />
      </Tab>
      <Tab
        href={PROFILE_PATH}
        label={m.shell.you}
        active={active.section === "profile"}
      >
        <YouIcon />
      </Tab>
    </nav>
  );
}
