import type { PointerEvent } from "react";
import { useReveal } from "../../hooks";

/** Writes the pointer position into the card, where the CSS spotlight reads it. */
function moveSpotlight(event: PointerEvent<HTMLElement>) {
  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  card.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
  card.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
}

export function StepCard({ title, text }: { title: string; text: string }) {
  const revealRef = useReveal<HTMLElement>();

  return (
    <article
      ref={revealRef}
      className="panel step-card"
      onPointerMove={moveSpotlight}
    >
      <h3 className="step-card__title">{title}</h3>
      <p className="step-card__text">{text}</p>
    </article>
  );
}
