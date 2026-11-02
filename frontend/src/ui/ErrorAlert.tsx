import { toUserMessage, useMessages } from "../i18n";
import { Alert } from "./Alert";

export function ErrorAlert({
  code,
  onRetry,
}: {
  code: string;
  onRetry: () => void;
}) {
  const m = useMessages();
  return (
    <>
      <Alert>{toUserMessage(code)}</Alert>
      <button
        type="button"
        className="button button--secondary"
        onClick={onRetry}
      >
        {m.tryAgain}
      </button>
    </>
  );
}
