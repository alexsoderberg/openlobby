import { Fragment, useRef, type MouseEvent } from "react";
import { loginUrl } from "../../api";
import { useFocusAfterLogout, useScrolledPast } from "../../hooks";
import { useMessages } from "../../i18n";
import { Alert, Brand } from "../../ui";
import { loggedOutNotice, type LoggedOutPageProps } from "../session";
import { LandingHero } from "./LandingHero";
import { LandingPreview } from "./LandingPreview";
import { StepCard } from "./StepCard";

/** The top bar turns frosted once the page is scrolled this far (px). */
const TOPBAR_SCROLL_OFFSET = 20;

/** Each line rises from its own clipped mask, in turn. The highlight word is upright gold. */
function HeadlineLines({
  lines,
  highlight,
}: {
  lines: readonly string[];
  highlight: string;
}) {
  return lines.map((line, lineIndex) => (
    <Fragment key={line}>
      {lineIndex > 0 && " "}
      <span className="hero__line">
        <span className="hero__line-inner">
          {line.split(" ").map((word, wordIndex) => (
            <Fragment key={wordIndex}>
              {wordIndex > 0 && " "}
              {word === highlight ? (
                <span className="hero__accent">{word}</span>
              ) : (
                word
              )}
            </Fragment>
          ))}
        </span>
      </span>
    </Fragment>
  ));
}

/** Logged-out start page. Login is the only action, so every login link goes to the same URL. */
export function LandingPage({
  returnTo,
  loginError,
  reason,
}: LoggedOutPageProps) {
  const m = useMessages();
  const t = m.landing;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepsRef = useRef<HTMLElement>(null);
  const scrolled = useScrolledPast(TOPBAR_SCROLL_OFFSET);
  const notice = loggedOutNotice(m, loginError, reason);
  const href = loginUrl(returnTo);
  useFocusAfterLogout(headingRef, reason === "loggedOut");

  // Focus moves with the scroll, so keyboard users land in the section, not just above it.
  function showSteps(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    stepsRef.current?.focus();
  }

  return (
    <>
      <header
        className={`topbar landing-topbar${scrolled ? " is-scrolled" : ""}`}
      >
        <Brand />
        <a className="button button-ghost" href={href}>
          {t.topBarLogIn}
        </a>
      </header>
      <main className="landing">
        {notice && <Alert>{notice}</Alert>}
        <section className="hero">
          <p className="hero__chip">{t.eyebrow}</p>
          <h1 ref={headingRef} tabIndex={-1} className="hero__title">
            <HeadlineLines
              lines={t.headlineLines}
              highlight={t.headlineHighlight}
            />
          </h1>
          <p className="hero__lead">{t.lead}</p>
          <div className="hero__actions">
            <a className="button" href={href}>
              {m.logInWithDiscord}
            </a>
            <a
              className="button button-ghost"
              href="#how-it-works"
              onClick={showSteps}
            >
              {t.howItWorks}
            </a>
          </div>
          <LandingHero />
        </section>
        <section
          id="how-it-works"
          ref={stepsRef}
          tabIndex={-1}
          aria-labelledby="how-it-works-heading"
          className="landing-section landing-steps"
        >
          <h2 id="how-it-works-heading" className="visually-hidden">
            {t.stepsHeading}
          </h2>
          <div className="steps">
            {t.steps.map((step) => (
              <StepCard key={step.title} title={step.title} text={step.text} />
            ))}
          </div>
        </section>
        <section className="landing-section" aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="landing-title">
            {t.previewHeading}
          </h2>
          <LandingPreview />
        </section>
      </main>
      <footer className="landing-footer">
        {m.brandLead}
        {m.brandAccent} · {t.footer}
      </footer>
    </>
  );
}
