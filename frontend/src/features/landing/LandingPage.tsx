import { useRef } from "react";
import { loginUrl } from "../../api";
import { useFocusAfterLogout, useScrolledPast } from "../../hooks";
import { useMessages } from "../../i18n";
import { Alert, Brand, Icon } from "../../ui";
import { loggedOutNotice, type LoggedOutPageProps } from "../session";
import { LandingHero } from "./LandingHero";
import { StepCard } from "./StepCard";

/** The top bar turns frosted once the page is scrolled this far (px). */
const TOPBAR_SCROLL_OFFSET = 20;

/** Logged-out start page. Login is the only action, so every login link goes to the same URL. */
export function LandingPage({
  returnTo,
  loginError,
  reason,
}: LoggedOutPageProps) {
  const m = useMessages();
  const t = m.landing;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrolled = useScrolledPast(TOPBAR_SCROLL_OFFSET);
  const notice = loggedOutNotice(m, loginError, reason);
  const href = loginUrl(returnTo);
  useFocusAfterLogout(headingRef, reason === "loggedOut");

  return (
    <>
      <header
        className={`topbar landing-topbar${scrolled ? " is-scrolled" : ""}`}
      >
        <Brand />
        <a className="button button-ghost" href={href}>
          <Icon name="logIn" />
          {t.topBarLogIn}
        </a>
      </header>
      <main className="landing">
        {notice && <Alert>{notice}</Alert>}
        <section className="hero">
          <h1 ref={headingRef} tabIndex={-1} className="hero__title">
            <span className="hero__line">
              <span className="hero__line-inner">{t.headline}</span>
            </span>
          </h1>
          <p className="hero__lead">{t.lead}</p>
          <div className="hero__actions">
            <a className="button" href={href}>
              <Icon name="logIn" />
              {m.logInWithDiscord}
            </a>
          </div>
          <LandingHero />
        </section>
        <section
          aria-labelledby="how-it-works-heading"
          className="landing-section"
        >
          <h2 id="how-it-works-heading" className="visually-hidden">
            {t.stepsHeading}
          </h2>
          <div className="steps">
            {t.steps.map((step, index) => (
              <StepCard
                key={step.title}
                title={`${index + 1}. ${step.title}`}
                text={step.text}
              />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
