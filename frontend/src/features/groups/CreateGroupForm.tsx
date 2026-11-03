import { useEffect, useRef } from "react";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert, Panel } from "../../ui";
import { INVALID_GROUP_NAME } from "./groupErrors";
import type { CreateGroupState } from "./useCreateGroup";

const HINT_ID = "group-name-hint";
const ERROR_ID = "group-name-error";

/** Focus moves to the field after an error and to the success message after creation. */
export function CreateGroupForm({
  state,
  onSubmit,
}: {
  state: CreateGroupState;
  onSubmit: (name: string) => void;
}) {
  const m = useMessages();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.status === "failed") inputRef.current?.focus();
    if (state.status === "created") {
      formRef.current?.reset();
      statusRef.current?.focus();
    }
  }, [state]);

  const fieldFailed =
    state.status === "failed" && state.code === INVALID_GROUP_NAME;
  const otherFailure =
    state.status === "failed" && state.code !== INVALID_GROUP_NAME
      ? state.code
      : undefined;

  return (
    <Panel>
      <h2>{m.createGroupHeading}</h2>
      <form
        ref={formRef}
        className="group-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(inputRef.current?.value ?? "");
        }}
      >
        <label htmlFor="group-name">{m.groupNameLabel}</label>
        <input
          id="group-name"
          ref={inputRef}
          type="text"
          autoComplete="off"
          aria-invalid={fieldFailed || undefined}
          aria-describedby={fieldFailed ? `${HINT_ID} ${ERROR_ID}` : HINT_ID}
        />
        <p id={HINT_ID} className="form-hint">
          {m.groupNameHint}
        </p>
        {fieldFailed && (
          <p id={ERROR_ID} className="field-error">
            {toUserMessage(INVALID_GROUP_NAME)}
          </p>
        )}
        <button
          type="submit"
          className="button"
          disabled={state.status === "saving"}
        >
          {m.createGroupSubmit}
        </button>
      </form>
      {otherFailure && <Alert>{toUserMessage(otherFailure)}</Alert>}
      {state.status === "created" && (
        <p ref={statusRef} tabIndex={-1} role="status">
          {m.groupCreated}
        </p>
      )}
    </Panel>
  );
}
