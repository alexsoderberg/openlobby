import { GROUP_NAME_MAX_LENGTH } from "../../api";

/** Trims the characters Go's strings.TrimSpace removes, so the local check agrees with the server. JS trim() also removes U+FEFF, which the server keeps. */
const SERVER_TRIM = /^\p{White_Space}+|\p{White_Space}+$/gu;

/** Quick feedback only. The server applies the same rule (trimmed, counted in code points) and is the source of truth. */
export function isValidGroupName(name: string): boolean {
  const length = [...name.replace(SERVER_TRIM, "")].length;
  return length > 0 && length <= GROUP_NAME_MAX_LENGTH;
}
