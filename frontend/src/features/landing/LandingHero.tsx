import { useEffect, useRef } from "react";
import { useMessages } from "../../i18n";
import {
  HERO_CARD_LAYOUT,
  HERO_MAX_PIXEL_RATIO,
  chooseHeroMode,
  heroCardContents,
  staticCardStyle,
} from "./hero";
import { browserLoopEnv, startHeroLoop } from "./heroLoop";
import {
  CARD_CANVAS_HEIGHT,
  CARD_CANVAS_WIDTH,
  paintLobbyCard,
  readCardStyle,
  type CardContent,
} from "./lobbyCardPainter";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type CreateHeroScene = typeof import("./heroScene").createHeroScene;

function hasWebGL(): boolean {
  const context = document.createElement("canvas").getContext("webgl2");
  context?.getExtension("WEBGL_lose_context")?.loseContext();
  return context !== null;
}

function paintCards(
  stage: HTMLElement,
  canvases: readonly HTMLCanvasElement[],
  contents: readonly CardContent[],
) {
  const style = readCardStyle(stage);
  canvases.forEach((canvas, index) =>
    paintLobbyCard(canvas, contents[index], style),
  );
}

/** Creates the scene and starts its loop. Returns the stop function, which also frees the scene. */
function runScene(
  createHeroScene: CreateHeroScene,
  stage: HTMLElement,
  canvases: readonly HTMLCanvasElement[],
): () => void {
  const scene = createHeroScene(stage, canvases, HERO_MAX_PIXEL_RATIO);
  try {
    // The hero is the stage's parent: the pointer is tracked over the whole hero, not only the cards.
    const stopLoop = startHeroLoop(
      scene,
      stage,
      stage.parentElement ?? stage,
      browserLoopEnv(),
    );
    stage.dataset.live = "";
    return () => {
      stopLoop();
      scene.dispose();
    };
  } catch (error) {
    scene.dispose(); // do not leak the WebGL context
    throw error;
  }
}

async function start(
  stage: HTMLElement,
  contents: readonly CardContent[],
  isCancelled: () => boolean,
): Promise<(() => void) | undefined> {
  const canvases = Array.from(stage.querySelectorAll("canvas"));
  try {
    // Painting waits for the fonts, so the canvas text uses the app's own fonts.
    await document.fonts?.ready;
    if (isCancelled()) return;
    paintCards(stage, canvases, contents);
    const mode = chooseHeroMode(
      window.matchMedia(REDUCED_MOTION_QUERY).matches,
      hasWebGL,
    );
    if (mode === "static") return;

    const { createHeroScene } = await import("./heroScene");
    if (isCancelled()) return;
    return runScene(createHeroScene, stage, canvases);
  } catch (error) {
    console.error(
      "The hero scene did not start; keeping the static cards.",
      error,
    );
  }
}

/** Decorative sample lobby cards. Static pictures first, 3D on top once the scene has loaded. */
export function LandingHero() {
  const m = useMessages();
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let cancelled = false;
    const stopped = start(stage, heroCardContents(m), () => cancelled);
    return () => {
      cancelled = true;
      delete stage.dataset.live;
      void stopped.then((stop) => stop?.());
    };
  }, [m]);

  return (
    <div ref={stageRef} className="hero-stage" aria-hidden="true">
      {HERO_CARD_LAYOUT.map((layout, index) => (
        <canvas
          key={index}
          className="hero-stage__card"
          width={CARD_CANVAS_WIDTH}
          height={CARD_CANVAS_HEIGHT}
          style={staticCardStyle(layout)}
        />
      ))}
    </div>
  );
}
