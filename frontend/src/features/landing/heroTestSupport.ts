import { vi } from "vitest";

/** What was drawn on one card canvas in its latest paint. */
export interface Painted {
  texts: string[];
  /** The `src` of each image drawn: the genre art. */
  images: string[];
}

/** jsdom has no canvas. This gives each 2D canvas a recording context and a WebGL context that can be switched off. */
export function stubCanvas({ webgl = true } = {}) {
  const painted = new Map<HTMLCanvasElement, Painted>();
  const contextOf = (canvas: HTMLCanvasElement) => {
    const record: Painted = { texts: [], images: [] };
    painted.set(canvas, record);
    const calls: Record<string, (...args: never[]) => unknown> = {
      fillText: (text: string) => record.texts.push(text),
      drawImage: (image: HTMLImageElement) =>
        record.images.push(image.getAttribute("src") ?? ""),
    };
    return new Proxy(
      {},
      { get: (_, name: string) => calls[name] ?? (() => ({ width: 0 })) },
    );
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement, kind: string) {
      if (kind === "2d") return contextOf(this);
      return webgl ? { getExtension: () => null } : null;
    } as never,
  );
  return painted;
}

export function stubReducedMotion(reducedMotion: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reducedMotion,
    media: query,
  })) as typeof window.matchMedia;
}
