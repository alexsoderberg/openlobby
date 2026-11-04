import { useReveal } from "../../hooks";

export function StepCard({ title, text }: { title: string; text: string }) {
  const revealRef = useReveal<HTMLElement>();

  return (
    <article ref={revealRef} className="panel step-card">
      <h3 className="step-card__title">{title}</h3>
      <p className="step-card__text">{text}</p>
    </article>
  );
}
