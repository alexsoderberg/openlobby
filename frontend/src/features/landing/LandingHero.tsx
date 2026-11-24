import { useEffect, useRef } from "react";
import { useMessages, type Messages } from "../../i18n";
import {
  HERO_MAX_PIXEL_RATIO,
  HERO_SAMPLE_CARDS,
  HERO_TIMING,
  chooseHeroMode,
  heroCardContent,
  type HeroSceneCard,
} from "./hero";
import {
  CARD_CANVAS_HEIGHT,
  CARD_CANVAS_WIDTH,
  paintHeroCard,
  readCardStyle,
} from "./heroCardPainter";
import { browserLoopEnv, startHeroLoop } from "./heroLoop";
import {
  HERO_AWAY,
  HERO_BEHIND,
  HERO_FRONT,
  staticCardStyle,
} from "./heroPose";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/** Where each static card rests. The static frame shows the first two; the third only exists in the scene. */
const STATIC_PLACES = [HERO_FRONT, HERO_BEHIND, HERO_AWAY];
const STATIC_VISIBLE_CARDS = 2;

type CreateHeroScene = typeof import("./heroScene").createHeroScene;

function hasWebGL(): boolean {
  const context = document.createElement("canvas").getContext("webgl2");
  context?.getExtension("WEBGL_lose_context")?.loseContext();
  return context !== null;
}

/** Paints every card at its start count, which is the static frame. */
function paintStaticFrame(cards: readonly HeroSceneCard[]) {
  cards.forEach((card, index) =>
    card.paint(HERO_SAMPLE_CARDS[index].startCount),
  );
}

/** Waits for the fonts, so the cards are painted in their own fonts, then paints the static frame. */
async function paintCards(
  stage: HTMLElement,
  m: Messages,
): Promise<HeroSceneCard[]> {
  const canvases = Array.from(stage.querySelectorAll("canvas"));
  await document.fonts?.ready;
  const style = readCardStyle(stage);
  const cards = HERO_SAMPLE_CARDS.map((_, index): HeroSceneCard => ({
    canvas: canvases[index],
    paint: (count) =>
      paintHeroCard(canvases[index], heroCardContent(m, index, count), style),
  }));
  paintStaticFrame(cards);
  return cards;
}

/**
 * Creates the scene and starts its loop. Returns the stop function, which also frees the scene.
 * If the browser loses the WebGL context, it stops by itself and the static cards show again.
 */
function runScene(
  createHeroScene: CreateHeroScene,
  stage: HTMLElement,
  cards: readonly HeroSceneCard[],
): () => void {
  const scene = createHeroScene(stage, cards, HERO_MAX_PIXEL_RATIO);
  let stopLoop = () => {};
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    stage.removeEventListener("webglcontextlost", onContextLost, true);
    stopLoop();
    delete stage.dataset.live;
    scene.dispose();
  };
  // The event does not bubble from the canvas, so it is caught while it travels down.
  const onContextLost = () => {
    stop();
    paintStaticFrame(cards);
  };
  try {
    // The hero is the stage's parent: the pointer is tracked over the whole hero, not only the cards.
    stopLoop = startHeroLoop(
      scene,
      stage,
      stage.parentElement ?? stage,
      browserLoopEnv(),
      HERO_SAMPLE_CARDS,
      HERO_TIMING,
    );
    stage.addEventListener("webglcontextlost", onContextLost, true);
    stage.dataset.live = "";
    return stop;
  } catch (error) {
    scene.dispose(); // do not leak the WebGL context
    throw error;
  }
}

async function start(
  stage: HTMLElement,
  m: Messages,
  isCancelled: () => boolean,
): Promise<(() => void) | undefined> {
  try {
    const cards = await paintCards(stage, m);
    if (isCancelled()) return;
    const mode = chooseHeroMode(
      window.matchMedia(REDUCED_MOTION_QUERY).matches,
      hasWebGL,
    );
    if (mode === "static") return;

    const { createHeroScene } = await import("./heroScene");
    if (isCancelled()) return;
    return runScene(createHeroScene, stage, cards);
  } catch (error) {
    console.error(
      "The hero scene did not start; keeping the static cards.",
      error,
    );
  }
}

/** Decorative sample cards. Static pictures first, 3D on top once the scene has loaded. */
export function LandingHero() {
  const m = useMessages();
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let cancelled = false;
    const stopped = start(stage, m, () => cancelled);
    return () => {
      cancelled = true;
      delete stage.dataset.live;
      void stopped.then((stop) => stop?.());
    };
  }, [m]);

  return (
    <div ref={stageRef} className="hero-stage" aria-hidden="true">
      {HERO_SAMPLE_CARDS.map(({ gameName }, index) => (
        <canvas
          key={gameName}
          className="hero-stage__card"
          width={CARD_CANVAS_WIDTH}
          height={CARD_CANVAS_HEIGHT}
          hidden={index >= STATIC_VISIBLE_CARDS}
          style={staticCardStyle(STATIC_PLACES[index])}
        />
      ))}
    </div>
  );
}
