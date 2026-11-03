import { useMessages } from "../i18n";

/** The logo: the first part in the text colour, "Lobby" in the accent. */
export function Brand() {
  const m = useMessages();
  return (
    <a className="brand" href="/">
      {m.brandLead}
      <span className="brand__accent">{m.brandAccent}</span>
    </a>
  );
}
