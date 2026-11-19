import { toUserMessage, useMessages } from "../i18n";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { Icon } from "./Icon";

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
      <Button type="button" variant="secondary" onClick={onRetry}>
        <Icon name="retry" />
        {m.tryAgain}
      </Button>
    </>
  );
}
