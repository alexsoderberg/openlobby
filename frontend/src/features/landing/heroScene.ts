import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import type { HeroPointer, HeroScene, HeroSceneCard } from "./hero";
import { heroCardCount, type HeroFrame } from "./heroCycle";
import {
  HERO_CAMERA_DISTANCE,
  HERO_CAMERA_FOV_DEG,
  HERO_CARD_HEIGHT,
  HERO_CARD_WIDTH,
  HERO_MAX_TILT_RAD,
  clampTilt,
  heroCardPose,
  heroRowScale,
} from "./heroPose";

// Tuning for the look; this lazy chunk is the only place that knows it.
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 50; // the cards sit about 7 units away; this leaves room without wasting depth precision
const FLOAT_AMPLITUDE = 0.08;
const FLOAT_SPEED = 0.7;
const SWAY_AMPLITUDE_RAD = 0.04;
/** Offsets each card's phase so the cards bob out of step. */
const CARD_PHASE_OFFSET = 2.1;
/** Sway on the y axis runs slower than on x, so the motion does not look like a fixed loop. */
const SWAY_Y_SPEED_RATIO = 0.8;
const NOT_PAINTED = -1;

function createRenderer(container: HTMLElement, maxPixelRatio: number) {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
  renderer.domElement.className = "hero-stage__gl";
  container.appendChild(renderer.domElement);
  return renderer;
}

interface SceneCard {
  mesh: Mesh;
  material: MeshBasicMaterial;
  texture: CanvasTexture;
  paintedCount: number;
}

function createCards(cardRow: Group, cards: readonly HeroSceneCard[]) {
  const geometry = new PlaneGeometry(HERO_CARD_WIDTH, HERO_CARD_HEIGHT);
  const sceneCards = cards.map((card): SceneCard => {
    const texture = new CanvasTexture(card.canvas);
    texture.colorSpace = SRGBColorSpace;
    // Unlit: the card shows the palette exactly as painted, flat, with no light or sheen (ADR 0028 section 2).
    const material = new MeshBasicMaterial({ map: texture, transparent: true });
    const mesh = new Mesh(geometry, material);
    cardRow.add(mesh);
    return {
      mesh,
      material,
      texture,
      paintedCount: NOT_PAINTED,
    };
  });
  const dispose = () => {
    geometry.dispose();
    sceneCards.forEach(({ material, texture }) => {
      material.dispose();
      texture.dispose();
    });
  };
  return { sceneCards, dispose };
}

/** Moves each card to its place in the cycle, with float, sway and pointer tilt. Total tilt stays inside 12 degrees. */
function poseCards(
  cards: readonly SceneCard[],
  frame: HeroFrame,
  elapsedSeconds: number,
  pointer: HeroPointer,
) {
  cards.forEach(({ mesh, material }, index) => {
    const pose = heroCardPose(index, frame, cards.length);
    const phase = elapsedSeconds * FLOAT_SPEED + index * CARD_PHASE_OFFSET;
    mesh.visible = pose.opacity > 0;
    material.opacity = pose.opacity;
    mesh.position.set(
      pose.x,
      pose.y + Math.sin(phase) * FLOAT_AMPLITUDE,
      pose.z,
    );
    const [tiltX, tiltY] = clampTilt(
      -pointer.y * HERO_MAX_TILT_RAD + Math.cos(phase) * SWAY_AMPLITUDE_RAD,
      pointer.x * HERO_MAX_TILT_RAD +
        Math.sin(phase * SWAY_Y_SPEED_RATIO) * SWAY_AMPLITUDE_RAD,
    );
    mesh.rotation.set(tiltX, tiltY, pose.roll);
  });
}

/** Repaints the textures of the cards whose player count changed since the last update. */
function repaintChanged(
  sceneCards: readonly SceneCard[],
  cards: readonly HeroSceneCard[],
  frame: HeroFrame,
  samples: readonly { startCount: number; maxCount: number }[],
) {
  sceneCards.forEach((card, index) => {
    const count = heroCardCount(index, frame, samples);
    if (count === card.paintedCount) return;
    cards[index].paint(count);
    card.texture.needsUpdate = true;
    card.paintedCount = count;
  });
}

function disposeRenderer(renderer: WebGLRenderer) {
  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.remove();
}

export function createHeroScene(
  container: HTMLElement,
  cards: readonly HeroSceneCard[],
  maxPixelRatio: number,
): HeroScene {
  const renderer = createRenderer(container, maxPixelRatio);
  try {
    return buildScene(renderer, container, cards);
  } catch (error) {
    disposeRenderer(renderer); // the canvas is already in the page; do not leak it or its context
    throw error;
  }
}

function createCamera() {
  const camera = new PerspectiveCamera(
    HERO_CAMERA_FOV_DEG,
    1,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.z = HERO_CAMERA_DISTANCE;
  return camera;
}

function sizer(
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  cardRow: Group,
): HeroScene["setSize"] {
  return (width, height) => {
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    cardRow.scale.setScalar(heroRowScale(camera.aspect));
  };
}

function buildScene(
  renderer: WebGLRenderer,
  container: HTMLElement,
  cards: readonly HeroSceneCard[],
): HeroScene {
  const scene = new Scene();
  const camera = createCamera();
  const cardRow = new Group();
  scene.add(cardRow);
  const { sceneCards, dispose: disposeCards } = createCards(cardRow, cards);
  const setSize = sizer(renderer, camera, cardRow);
  setSize(container.clientWidth, container.clientHeight);
  return {
    update: (frame, samples) =>
      repaintChanged(sceneCards, cards, frame, samples),
    render: (frame, elapsedSeconds, pointer) => {
      poseCards(sceneCards, frame, elapsedSeconds, pointer);
      renderer.render(scene, camera);
    },
    setSize,
    dispose: () => {
      disposeCards();
      disposeRenderer(renderer);
    },
  };
}
