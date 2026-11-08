import type { Ref } from "react";
import type { Game } from "../../api";
import { GENRE_OPTIONS } from "../../genres";
import { useMessages } from "../../i18n";

/** The genre choice: "No genre" first (empty value), then the fixed list. `errorId` is set when the form's error is about this field. */
export function GameGenreField({
  id,
  ref,
  genre,
  errorId,
}: {
  id: string;
  ref: Ref<HTMLSelectElement>;
  genre: Game["genre"];
  errorId?: string;
}) {
  const m = useMessages();
  return (
    <>
      <label htmlFor={id}>{m.gameGenreLabel}</label>
      <select
        id={id}
        ref={ref}
        name="genre"
        defaultValue={genre ?? ""}
        aria-invalid={errorId !== undefined || undefined}
        aria-describedby={errorId}
      >
        <option value="">{m.genre.none}</option>
        {GENRE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {m.genre[option]}
          </option>
        ))}
      </select>
    </>
  );
}
