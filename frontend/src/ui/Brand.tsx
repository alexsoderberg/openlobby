import { useMessages } from "../i18n";

/** The logo, all in the text colour: gold is only for action and state (REQ-0028 item 1). */
export function Brand() {
  const m = useMessages();
  return (
    <a className="brand" href="/">
      {m.brandLead}
      {m.brandAccent}
    </a>
  );
}
