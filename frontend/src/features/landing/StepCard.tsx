import { useReveal } from "../../hooks";

/** One step of "How it works". The number is part of the heading, so it is read as "1. Log in". */
export function StepCard({
  number,
  title,
  text,
}: {
  number: number;
  title: string;
  text: string;
}) {
  const revealRef = useReveal<HTMLElement>();

  return (
    <article ref={revealRef} className="step-card">
      <h3 className="step-card__title">
        <span className="step-card__number">{number}.</span> {title}
      </h3>
      <p className="step-card__text">{text}</p>
    </article>
  );
}
