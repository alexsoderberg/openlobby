import { useMessages } from "../i18n";

/** The logo in one colour: signal is only for the uses of the Orange rule (ADR 0028 section 16.4). */
export function Brand() {
  const m = useMessages();
  return (
    <a className="brand" href="/">
      {m.brandLead}
      {m.brandAccent}
    </a>
  );
}
