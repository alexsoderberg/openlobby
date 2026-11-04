import { useState } from "react";
import type { ChangeResult, CreateLobbyInput } from "../../api";
import { fieldOf } from "./lobbyFieldOf";
import { parseLobbyInput, readFields } from "./lobbyInput";

/** Checks the fields locally, then saves. Keeps the error code the attempt ended with and focuses its field. */
export function useLobbyFormSubmit(
  gameValue: string,
  onGameChange: (value: string) => void,
  onSubmit: (input: CreateLobbyInput) => ChangeResult,
) {
  const [errorCode, setErrorCode] = useState<string>();

  async function submit(form: HTMLFormElement) {
    const parsed = parseLobbyInput(readFields(form), new Date());
    const code = parsed.ok ? await onSubmit(parsed.input) : parsed.code;
    setErrorCode(code);
    if (code === undefined) {
      form.reset();
      onGameChange("");
      return;
    }
    const field = form.elements.namedItem(fieldOf(code, gameValue));
    if (field instanceof HTMLElement) field.focus();
  }

  return { errorCode, submit };
}
