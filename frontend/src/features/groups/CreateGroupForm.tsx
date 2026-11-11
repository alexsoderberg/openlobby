import { useEffect, useRef } from "react";
import { toUserMessage, useMessages } from "../../i18n";
import { Alert, Icon } from "../../ui";
import { INVALID_GROUP_NAME } from "./groupErrors";
import type { CreateGroupState } from "./useCreateGroup";

const HINT_ID = "group-name-hint";
const ERROR_ID = "group-name-error";

/**
 * Focus moves to the field when the form opens and after an error, and to the success message after
 * creation. The form is opened by remounting it, so it starts empty each time.
 */
export function CreateGroupForm({
  state,
  onSubmit,
  onCancel,
}: {
  state: CreateGroupState;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const m = useMessages();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

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
    <>
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
        <div className="form-actions">
          <button
            type="submit"
            className="button"
            disabled={state.status === "saving"}
          >
            <Icon name="plus" />
            {m.createGroupSubmit}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
          >
            <Icon name="close" />
            {m.cancel}
          </button>
        </div>
      </form>
      {otherFailure && <Alert>{toUserMessage(otherFailure)}</Alert>}
      {state.status === "created" && (
        <p ref={statusRef} tabIndex={-1} role="status">
          {m.groupCreated}
        </p>
      )}
    </>
  );
}
