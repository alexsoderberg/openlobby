# Running order: reference mockup (REQ-0029)

The chosen direction of REQ-0029 (concept A, "Running order (light)", decided 2026-11-21) as a static mockup.

- `home.html`, `group.html`, `lobby.html`, `style.css`: the three screens (Home, the Group view, the lobby page) in plain HTML and CSS.
- `shots/`: screenshots of the mockup at 1440 px (desktop) and 390 px (phone).

This is a reference, not app code. Nothing here is built, tested or deployed. The mockup loads its fonts and icons from CDNs; the app does not. The app loads Big Shoulders Display and Archivo from `frontend/public/fonts/` (ADR 0028).

Once the redesign is built, the app implementation is the source of truth, not this mockup. Where they differ, REQ-0029 and ADR 0028 decide, and this folder is updated or removed.

## Known differences from the decisions

The mockups are not copied where they differ from REQ-0029 and ADR 0028. Do not copy these:

- **Create lobby button and floating "+" on Home** (`home.html`). Home has neither. Create lobby is only inside a group (REQ-0029 item 4; DECISION (user, 2026-11-21)).
- **"Open lobby" on the Next up band** (`home.html`). The button reads "Join lobby" (REQ-0029 item 14).
- **"10:27" label on the Now line** (`style.css`, `.now::before`). The Now line has no label (REQ-0029 item 4).
- **Grey blocks for past lobbies** (`style.css`, `.ro__day--past .act`). Blocks use only the six group colours (REQ-0029 item 11, ADR 0028 section 5).
- **Group name chip on the Next up band** (`home.html`). The band shows the fields of REQ-0029 item 4, not the group name.
- **Google Fonts and unpkg loads** (`<link>` and `<script>` in each HTML file). The app makes no request to a third party. Its fonts are self-hosted in `frontend/public/fonts/` (ADR 0028 section 2), and its icons come from `ui/Icon.tsx` (ADR 0021).
- **Sample names, times and counts** (group names, lobby labels, dates, "12:35") are placeholders, not product copy.
