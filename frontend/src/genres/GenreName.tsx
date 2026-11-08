import type { Genre } from "../api";
import { useMessages } from "../i18n";

/** The genre as text, so colour and icon are never the only signal. A neutral lobby has no genre, so no name. */
export function GenreName({ genre }: { genre: Genre | null }) {
  const m = useMessages();
  return genre && <span className="genre-name">{m.genre[genre]}</span>;
}
