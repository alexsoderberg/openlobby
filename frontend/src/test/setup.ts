import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom has no modal dialog. This stand-in opens and closes it the way a browser reports it.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom has no matchMedia; useReveal asks it for reduced motion. Default: motion allowed.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query }) as MediaQueryList;
}
