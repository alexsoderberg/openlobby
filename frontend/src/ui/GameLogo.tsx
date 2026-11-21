import { useState } from "react";
import { gameImageUrl } from "../api";
import { classNames } from "./classNames";
import { initialsOf } from "./initials";

const SIZE_CLASSES = {
  regular: "size-(--size-game-logo)",
  large: "size-(--size-game-logo-large)",
  small: "size-(--size-game-logo-small)",
};

/**
 * A game's logo in a fixed box, or its monogram when it has none or the image fails to load. Decorative: the
 * caller always shows the game name as text beside it (REQ-0026, WCAG 1.1.1). A square with small corners (ADR 0028
 * section 16.8); the monogram has the colours of an avatar's initials. Its type is in global.css under
 * [data-slot="game-logo"] (ADR 0023 point 2). `large` is for the places where the game is central: Next up and the
 * lobby page; `small` is one text line of a week block (ADR 0026 Amendment item 11).
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
  size?: keyof typeof SIZE_CLASSES;
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
        "grid flex-none place-items-center overflow-hidden rounded-(--radius-sm)",
        SIZE_CLASSES[size],
        image ? undefined : "bg-(--color-raised) text-(--color-text)",
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
