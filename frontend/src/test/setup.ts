import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom has no matchMedia; useReveal asks it for reduced motion. Default: motion allowed.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query }) as MediaQueryList;
}
