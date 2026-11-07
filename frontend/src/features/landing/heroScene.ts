import {
  AmbientLight,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import {
  HERO_CARD_HEIGHT,
  HERO_CARD_LAYOUT,
  HERO_CARD_WIDTH,
  HERO_MAX_TILT_RAD,
  HERO_VIEW_HEIGHT,
  clampTilt,
  heroRowScale,
  type HeroPointer,
  type HeroScene,
} from "./hero";

// Tuning for the look; this lazy chunk is the only place that knows it.
const CAMERA_FOV_DEG = 30;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 50; // the cards sit about 7 units away; this leaves room without wasting depth precision
/** Distance at which the camera sees exactly HERO_VIEW_HEIGHT. */
const CAMERA_DISTANCE =
  HERO_VIEW_HEIGHT / 2 / Math.tan((CAMERA_FOV_DEG / 2) * (Math.PI / 180));
const FLOAT_AMPLITUDE = 0.1;
const FLOAT_SPEED = 0.7;
const SWAY_AMPLITUDE_RAD = 0.04;
/** Offsets each card's phase so the three bob out of step. */
const CARD_PHASE_OFFSET = 2.1;
/** Sway on the y axis runs slower than on x, so the motion does not look like a fixed loop. */
const SWAY_Y_SPEED_RATIO = 0.8;
const LIGHT_REACH = 1.6;
const LIGHT_HEIGHT = 2.2;
const LIGHT_INTENSITY = 14;
const LIGHT_DECAY = 1.5; // softer falloff than physical (2), so the far cards still catch some light
const AMBIENT_INTENSITY = 1.6;
const CARD_ROUGHNESS = 0.45;

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

function addLights(scene: Scene) {
  const white = new Color("white");
  scene.add(new AmbientLight(white, AMBIENT_INTENSITY));
  const light = new PointLight(white, LIGHT_INTENSITY, 0, LIGHT_DECAY);
  light.position.set(0, 0, LIGHT_HEIGHT);
  scene.add(light);
  return light;
}

function createCards(row: Group, cardCanvases: readonly HTMLCanvasElement[]) {
  const geometry = new PlaneGeometry(HERO_CARD_WIDTH, HERO_CARD_HEIGHT);
  const textures: CanvasTexture[] = [];
  const materials: MeshStandardMaterial[] = [];
  const cards = cardCanvases.map((canvas, index) => {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const material = new MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: CARD_ROUGHNESS,
    });
    textures.push(texture);
    materials.push(material);
    const card = new Mesh(geometry, material);
    const { x, y, z } = HERO_CARD_LAYOUT[index];
    card.position.set(x, y, z);
    row.add(card);
    return card;
  });
  const dispose = () => {
    geometry.dispose();
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  };
  return { cards, dispose };
}

/** Float, sway and pointer tilt. The total tilt stays inside the 12 degree limit. */
function poseCards(
  cards: readonly Mesh[],
  elapsedSeconds: number,
  pointer: HeroPointer,
) {
  cards.forEach((card, index) => {
    const { y, roll } = HERO_CARD_LAYOUT[index];
    const phase = elapsedSeconds * FLOAT_SPEED + index * CARD_PHASE_OFFSET;
    card.position.y = y + Math.sin(phase) * FLOAT_AMPLITUDE;
    const [tiltX, tiltY] = clampTilt(
      -pointer.y * HERO_MAX_TILT_RAD + Math.cos(phase) * SWAY_AMPLITUDE_RAD,
      pointer.x * HERO_MAX_TILT_RAD +
        Math.sin(phase * SWAY_Y_SPEED_RATIO) * SWAY_AMPLITUDE_RAD,
    );
    card.rotation.set(tiltX, tiltY, roll);
  });
}

function disposeRenderer(renderer: WebGLRenderer) {
  renderer.dispose();
  renderer.forceContextLoss();
  renderer.domElement.remove();
}

export function createHeroScene(
  container: HTMLElement,
  cardCanvases: readonly HTMLCanvasElement[],
  maxPixelRatio: number,
): HeroScene {
  const renderer = createRenderer(container, maxPixelRatio);
  try {
    return buildScene(renderer, container, cardCanvases);
  } catch (error) {
    disposeRenderer(renderer); // the canvas is already in the page; do not leak it or its context
    throw error;
  }
}

function buildScene(
  renderer: WebGLRenderer,
  container: HTMLElement,
  cardCanvases: readonly HTMLCanvasElement[],
): HeroScene {
  const scene = new Scene();
  const camera = new PerspectiveCamera(
    CAMERA_FOV_DEG,
    1,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  camera.position.z = CAMERA_DISTANCE;
  const light = addLights(scene);
  const row = new Group();
  scene.add(row);
  const { cards, dispose: disposeCards } = createCards(row, cardCanvases);

  function render(elapsedSeconds: number, pointer: HeroPointer) {
    poseCards(cards, elapsedSeconds, pointer);
    // The light follows the pointer so the sheen on the cards moves with it.
    light.position.set(
      pointer.x * LIGHT_REACH,
      pointer.y * LIGHT_REACH,
      LIGHT_HEIGHT,
    );
    renderer.render(scene, camera);
  }

  function setSize(width: number, height: number) {
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    row.scale.setScalar(heroRowScale(camera.aspect));
  }

  function dispose() {
    disposeCards();
    disposeRenderer(renderer);
  }

  setSize(container.clientWidth, container.clientHeight);
  return { render, setSize, dispose };
}
