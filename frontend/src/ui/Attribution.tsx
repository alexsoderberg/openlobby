import { useMessages } from "../i18n";

/** The credit Blizzard's terms ask for. Each page that shows item names or icons renders it once (ADR 0029). */
export function Attribution() {
  const m = useMessages();
  return <p className="attribution">{m.attribution}</p>;
}
