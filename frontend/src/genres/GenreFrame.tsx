import type { CSSProperties, HTMLAttributes } from "react";
import type { Genre } from "../api";
import { themeForGenre } from "./genreThemes";

/**
 * Wraps a lobby view in the theme of a genre: sets the accent, draws the pattern behind the children, and
 * adds the icon and, when asked, the flat motif. The art is decorative, so it is hidden from assistive
 * technology. The theme has no motion. The host supplies the layout through `className`.
 */
export function GenreFrame({
  genre,
  as: Tag = "div",
  className,
  motif = false,
  style,
  children,
  ...attributes
}: HTMLAttributes<HTMLElement> & {
  genre: Genre | null;
  as?: "div" | "li" | "article" | "header";
  motif?: boolean;
}) {
  const theme = themeForGenre(genre);
  const themeStyle = {
    "--genre-accent": `var(${theme.accentVar})`,
    "--genre-pattern": `url(${theme.patternUrl})`,
  } as CSSProperties;
  return (
    <Tag
      className={className ? `genre-frame ${className}` : "genre-frame"}
      style={{ ...themeStyle, ...style }}
      data-genre={theme.key}
      {...attributes}
    >
      <img
        className="genre-frame__icon"
        src={theme.iconUrl}
        alt=""
        aria-hidden="true"
      />
      {motif && (
        <img
          className="genre-frame__motif"
          src={theme.motifUrl}
          alt=""
          aria-hidden="true"
        />
      )}
      {children}
    </Tag>
  );
}
