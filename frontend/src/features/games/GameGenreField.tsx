import { useState, type Ref } from "react";
import type { Game } from "../../api";
import { GENRE_OPTIONS } from "../../genres";
import { useMessages } from "../../i18n";
import { Select } from "../../ui";

/**
 * The genre choice: "No genre" first (empty value), then the fixed list. `errorId` is set when the form's error is
 * about this field. A form reset puts back the game's genre.
 */
export function GameGenreField({
  id,
  ref,
  genre,
  errorId,
}: {
  id: string;
  ref: Ref<HTMLButtonElement>;
  genre: Game["genre"];
  errorId?: string;
}) {
  const m = useMessages();
  const [value, setValue] = useState<string>(genre ?? "");
  return (
    <>
      <label htmlFor={id}>{m.gameGenreLabel}</label>
      <Select
        id={id}
        ref={ref}
        name="genre"
        value={value}
        onValueChange={setValue}
        aria-invalid={errorId !== undefined || undefined}
        aria-describedby={errorId}
        options={[
          { value: "", label: m.genre.none },
          ...GENRE_OPTIONS.map((option) => ({
            value: option,
            label: m.genre[option],
          })),
        ]}
      />
    </>
  );
}
