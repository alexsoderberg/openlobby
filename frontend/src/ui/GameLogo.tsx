import { useState } from "react";
import { gameImageUrl } from "../api";
import { classNames } from "./classNames";
import { initialsOf } from "./initials";

/**
 * A game's logo in a fixed box, or its monogram when it has none or the image fails to load. Decorative: the
 * caller always shows the game name as text beside it (REQ-0026, WCAG 1.1.1). A rounded square, so a game never
 * reads as a person's round avatar; the monogram has the colours of an avatar's initials. Type and border style
 * are in global.css under [data-slot="game-logo"] (ADR 0023 point 2). `large` is for the places where the game is
 * central: Next up and the lobby page.
 */
export function GameLogo({
  gameId,
  name,
  version,
  size = "regular",
}: {
  gameId: string;
  name: string;
  version?: string | null;
  size?: "regular" | "large";
}) {
  // The version that failed, so a new upload is tried again.
  const [failedVersion, setFailedVersion] = useState<string>();
  const image = version && version !== failedVersion ? version : undefined;
  return (
    <span
      data-slot="game-logo"
      data-shows={image ? "logo" : "monogram"}
      data-size={size}
      aria-hidden="true"
      className={classNames(
        "grid flex-none place-items-center overflow-hidden rounded-(--radius-control)",
        size === "large"
          ? "size-(--size-game-logo-large)"
          : "size-(--size-game-logo)",
        image
          ? undefined
          : "border border-(--color-accent-line) bg-(--color-accent-tint) text-(--color-text)",
      )}
    >
      {image ? (
        <img
          className="size-full object-contain"
          src={gameImageUrl(gameId, "logo", image)}
          alt=""
          onError={() => setFailedVersion(image)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
