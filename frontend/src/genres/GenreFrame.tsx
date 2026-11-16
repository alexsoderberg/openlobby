import { useState, type CSSProperties, type HTMLAttributes } from "react";
import type { Genre } from "../api";
import { themeForGenre } from "./genreThemes";

/**
 * Wraps a lobby view in the theme of a genre: sets the accent, draws the pattern behind the children, and
 * adds the icon and, when asked, the flat motif. The art is decorative, so it is hidden from assistive
 * technology. The theme has no motion. The host supplies the layout through `className`.
 * A `coverUrl` draws the game cover behind the content under the scrim, in place of the pattern; the accent and
 * the icon stay. A cover that fails to load leaves the pattern (ADR 0026 point 8).
 */
export function GenreFrame({
  genre,
  as: Tag = "div",
  className,
  motif = false,
  coverUrl,
  style,
  children,
  ...attributes
}: HTMLAttributes<HTMLElement> & {
  genre: Genre | null;
  as?: "div" | "li" | "article" | "header";
  motif?: boolean;
  coverUrl?: string;
}) {
  const theme = themeForGenre(genre);
  // The URL that failed, so a new cover is tried again.
  const [failedUrl, setFailedUrl] = useState<string>();
  const cover = coverUrl !== failedUrl ? coverUrl : undefined;
  const themeStyle = {
    "--genre-accent": `var(${theme.accentVar})`,
    "--genre-pattern": `url(${theme.patternUrl})`,
  } as CSSProperties;
  return (
    <Tag
      className={className ? `genre-frame ${className}` : "genre-frame"}
      style={{ ...themeStyle, ...style }}
      data-genre={theme.key}
      data-cover={cover ? "" : undefined}
      {...attributes}
    >
      {cover && (
        <img
          className="genre-frame__cover"
          src={cover}
          alt=""
          onError={() => setFailedUrl(cover)}
        />
      )}
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
