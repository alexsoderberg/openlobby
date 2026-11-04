import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = () => (
  <Icon>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
  </Icon>
);

export const GroupsIcon = () => (
  <Icon>
    <circle cx="9" cy="9" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
    <circle cx="17" cy="8" r="2.7" />
    <path d="M16.5 13.5c2.6.2 4.4 2 5 4.8" />
  </Icon>
);

export const YouIcon = () => (
  <Icon>
    <circle cx="12" cy="8.5" r="4" />
    <path d="M4 21c1-4.2 4.2-6.5 8-6.5s7 2.3 8 6.5" />
  </Icon>
);
