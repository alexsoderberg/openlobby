import { useState } from "react";
import type { ChangeResult, CreateLobbyInput } from "../../api";
import { fieldOf } from "./lobbyFieldOf";
import { parseLobbyInput, readFields, slotInputName } from "./lobbyInput";

/** The control of a field. With game roles, the max players error is about the first slot. */
const selectorOf = (field: string) =>
  field === "maxPlayers"
    ? `[name="maxPlayers"], [name^="${slotInputName("")}"]`
    : `[name="${field}"]:not(:disabled)`;

/** Checks the fields locally, then saves. Keeps the error code the attempt ended with and focuses its field. */
export function useLobbyFormSubmit(
  gameValue: string,
  onReset: () => void,
  onSubmit: (input: CreateLobbyInput) => ChangeResult,
) {
  const [errorCode, setErrorCode] = useState<string>();

  async function submit(form: HTMLFormElement) {
    const parsed = parseLobbyInput(readFields(form), new Date());
    const code = parsed.ok ? await onSubmit(parsed.input) : parsed.code;
    setErrorCode(code);
    if (code === undefined) {
      form.reset();
      onReset();
      return;
    }
    form
      .querySelector<HTMLElement>(selectorOf(fieldOf(code, gameValue)))
      ?.focus();
  }

  const errorField = errorCode && fieldOf(errorCode, gameValue);
  return { errorCode, errorField, submit };
}
