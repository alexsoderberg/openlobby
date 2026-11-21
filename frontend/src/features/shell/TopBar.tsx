import type { ReactNode } from "react";
import type { AuthUser } from "../../api";
import { useMessages } from "../../i18n";
import { Avatar, Brand, Icon } from "../../ui";
import { GROUPS_PATH } from "../groups";
import { PROFILE_PATH } from "../profile";
import { HOME_PATH, type ActiveNav } from "./activeNav";

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
      <span className="tab__label" data-label={label}>
        {label}
      </span>
    </a>
  );
}

/**
 * The Wordmark, the tabs Home, Groups and You, and the logged-in user, who links to the You page. One nav in
 * the DOM: from 760px the tabs sit in the bar; on phones CSS moves the same nav to the bottom as the Tab bar,
 * where the tab icons show (ADR 0028 section 3).
 */
export function TopBar({
  user,
  active,
}: {
  user: AuthUser;
  active: ActiveNav;
}) {
  const m = useMessages();
  return (
    <header className="top-bar">
      <Brand />
      <nav className="tab-bar" aria-label={m.shell.mainNav}>
        <Tab
          href={HOME_PATH}
          label={m.shell.home}
          active={active.section === "home"}
        >
          <Icon name="home" className="nav-icon" />
        </Tab>
        <Tab
          href={GROUPS_PATH}
          label={m.shell.groups}
          active={active.section === "groups"}
        >
          <Icon name="groups" className="nav-icon" />
        </Tab>
        <Tab
          href={PROFILE_PATH}
          label={m.shell.you}
          active={active.section === "profile"}
        >
          <Icon name="you" className="nav-icon" />
        </Tab>
      </nav>
      <a
        className="top-bar__user"
        href={PROFILE_PATH}
        aria-label={m.shell.openProfile(user.displayName)}
      >
        <span className="top-bar__name">{user.displayName}</span>
        <Avatar name={user.displayName} />
      </a>
    </header>
  );
}
