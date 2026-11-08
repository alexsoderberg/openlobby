import {
  AmbientLight,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from "three";
import type { MotifKind } from "../../genres";
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
const LIGHT_REACH = 1.6;
const LIGHT_HEIGHT = 2.2;
// Kept low so the light does not wash out the card text; the user asked for soft light.
const LIGHT_INTENSITY = 8;
const LIGHT_DECAY = 1.5; // softer falloff than physical (2), so the card behind still catches some light
const AMBIENT_INTENSITY = 1.6;
const CARD_ROUGHNESS = 0.6;
const MOTIF_ROUGHNESS = 0.35;
/** Where the motif floats over a card: right of the name, clear of the meter, in front of the surface. */
const MOTIF_POSITION = { x: 0.77, y: 0.04, z: 0.2 };
/** Longest side of any motif, in world units, so every kind is equally large on the card. */
const MOTIF_SIZE = 0.62;
const MOTIF_SPIN_RAD = 0.5;
const MOTIF_SPIN_SPEED = 0.9;
const NOT_PAINTED = -1;

// Sizes of the motif parts, in an arbitrary unit: each motif is scaled to MOTIF_SIZE afterwards.
const PART_STEP = 0.3;
const RING_SEGMENTS = 32;
const ROUND_WIDTH_SEGMENTS = 16;
const ROUND_HEIGHT_SEGMENTS = 12;
const RETICLE = { radius: 0.5, tube: 0.04, tubeSegments: 8 };
const TOWER = { width: 0.22, baseHeight: 0.3, extraHeight: 0.5 };
const CHEVRON = { radius: 0.22, height: 0.26, sides: 3 };
const GRID_CELL = { size: 0.2, depth: 0.08 };
const PEAK = { radius: 0.2, height: 0.4, extraHeight: 0.25, sides: 4 };
const CONFETTI = { size: 0.1, depth: 0.03, spread: 0.12, angleStep: 2.4 };
const FRAME = { radius: 0.5, inset: 0.18, tube: 0.04, sides: 4 };
const BALL = { radius: 0.3 };
const PIN = {
  headRadius: 0.18,
  headY: 0.2,
  coneRadius: 0.16,
  coneHeight: 0.4,
  coneY: -0.1,
  coneSides: 12,
};

interface Part {
  geometry: BufferGeometry;
  x: number;
  y: number;
  roll: number;
}

const part = (geometry: BufferGeometry, x = 0, y = 0, roll = 0): Part => ({
  geometry,
  x,
  y,
  roll,
});
/** `count` parts side by side, centred on x. */
const row = (count: number, make: (index: number) => Part) =>
  Array.from({ length: count }, (_, i) => ({
    ...make(i),
    x: (i - (count - 1) / 2) * PART_STEP,
  }));
const share = (index: number, count: number) => (index + 1) / count;
const sphere = (radius: number) =>
  new SphereGeometry(radius, ROUND_WIDTH_SEGMENTS, ROUND_HEIGHT_SEGMENTS);

/** One 3D shape per motif kind. The count of parts comes from the genre theme (genres/genreThemes.ts). */
const MOTIFS: Record<MotifKind, (count: number) => Part[]> = {
  reticle: (count) =>
    Array.from({ length: count }, (_, i) =>
      part(
        new TorusGeometry(
          RETICLE.radius * share(i, count),
          RETICLE.tube,
          RETICLE.tubeSegments,
          RING_SEGMENTS,
        ),
      ),
    ),
  towers: (count) =>
    row(count, (i) =>
      part(
        new BoxGeometry(
          TOWER.width,
          TOWER.baseHeight + TOWER.extraHeight * share(i, count),
          TOWER.width,
        ),
      ),
    ),
  chevrons: (count) =>
    row(count, () =>
      part(
        new ConeGeometry(CHEVRON.radius, CHEVRON.height, CHEVRON.sides),
        0,
        0,
        -Math.PI / 2,
      ),
    ),
  grid: (count) => {
    const side = Math.ceil(Math.sqrt(count));
    return Array.from({ length: count }, (_, i) =>
      part(
        new BoxGeometry(GRID_CELL.size, GRID_CELL.size, GRID_CELL.depth),
        ((i % side) - (side - 1) / 2) * PART_STEP,
        (Math.floor(i / side) - (side - 1) / 2) * -PART_STEP,
      ),
    );
  },
  peaks: (count) =>
    row(count, (i) =>
      part(
        new ConeGeometry(
          PEAK.radius,
          PEAK.height + PEAK.extraHeight * (i % 2),
          PEAK.sides,
        ),
      ),
    ),
  confetti: (count) =>
    Array.from({ length: count }, (_, i) => {
      const reach = CONFETTI.spread * (1 + i / 2);
      return part(
        new BoxGeometry(CONFETTI.size, CONFETTI.size, CONFETTI.depth),
        Math.cos(i * CONFETTI.angleStep) * reach,
        Math.sin(i * CONFETTI.angleStep) * reach,
        i,
      );
    }),
  frame: (count) =>
    Array.from({ length: count }, (_, i) =>
      part(
        new TorusGeometry(
          FRAME.radius - i * FRAME.inset,
          FRAME.tube,
          FRAME.sides,
          FRAME.sides,
        ),
        0,
        0,
        Math.PI / 4,
      ),
    ),
  ball: (count) => row(count, () => part(sphere(BALL.radius))),
  pin: () => [
    part(sphere(PIN.headRadius), 0, PIN.headY),
    part(
      new ConeGeometry(PIN.coneRadius, PIN.coneHeight, PIN.coneSides),
      0,
      PIN.coneY,
      Math.PI,
    ),
  ],
};

const MOTIF_BOX = new Box3();
const MOTIF_SIZES = new Vector3();

function buildMotif(kind: MotifKind, count: number, accent: string) {
  const material = new MeshStandardMaterial({
    color: new Color(accent),
    roughness: MOTIF_ROUGHNESS,
    transparent: true,
    side: DoubleSide,
  });
  const group = new Group();
  const parts = MOTIFS[kind](count);
  parts.forEach(({ geometry, x, y, roll }) => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, 0);
    mesh.rotation.z = roll;
    group.add(mesh);
  });
  MOTIF_BOX.setFromObject(group).getSize(MOTIF_SIZES);
  group.scale.setScalar(MOTIF_SIZE / Math.max(MOTIF_SIZES.x, MOTIF_SIZES.y));
  group.position.set(MOTIF_POSITION.x, MOTIF_POSITION.y, MOTIF_POSITION.z);
  return { group, material, geometries: parts.map((p) => p.geometry) };
}

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

interface SceneCard {
  mesh: Mesh;
  motif: Group;
  motifGeometries: BufferGeometry[];
  materials: MeshStandardMaterial[];
  texture: CanvasTexture;
  paintedCount: number;
}

function createCards(cardRow: Group, cards: readonly HeroSceneCard[]) {
  const geometry = new PlaneGeometry(HERO_CARD_WIDTH, HERO_CARD_HEIGHT);
  const sceneCards = cards.map((card): SceneCard => {
    const texture = new CanvasTexture(card.canvas);
    texture.colorSpace = SRGBColorSpace;
    const surface = new MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: CARD_ROUGHNESS,
    });
    const mesh = new Mesh(geometry, surface);
    const { group, material, geometries } = buildMotif(
      card.motif.kind,
      card.motif.count,
      card.accent,
    );
    mesh.add(group);
    cardRow.add(mesh);
    return {
      mesh,
      motif: group,
      motifGeometries: geometries,
      materials: [surface, material],
      texture,
      paintedCount: NOT_PAINTED,
    };
  });
  const dispose = () => {
    geometry.dispose();
    sceneCards.forEach(({ motifGeometries, materials, texture }) => {
      motifGeometries.forEach((motifGeometry) => motifGeometry.dispose());
      materials.forEach((material) => material.dispose());
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
  cards.forEach(({ mesh, motif, materials }, index) => {
    const pose = heroCardPose(index, frame, cards.length);
    const phase = elapsedSeconds * FLOAT_SPEED + index * CARD_PHASE_OFFSET;
    mesh.visible = pose.opacity > 0;
    materials.forEach((material) => (material.opacity = pose.opacity));
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
    motif.rotation.y =
      Math.sin(elapsedSeconds * MOTIF_SPIN_SPEED + index) * MOTIF_SPIN_RAD;
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

/** The light follows the pointer so the sheen on the cards moves with it. */
const followPointer = (light: PointLight, pointer: HeroPointer) =>
  light.position.set(
    pointer.x * LIGHT_REACH,
    pointer.y * LIGHT_REACH,
    LIGHT_HEIGHT,
  );

function buildScene(
  renderer: WebGLRenderer,
  container: HTMLElement,
  cards: readonly HeroSceneCard[],
): HeroScene {
  const scene = new Scene();
  const camera = createCamera();
  const light = addLights(scene);
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
      followPointer(light, pointer);
      renderer.render(scene, camera);
    },
    setSize,
    dispose: () => {
      disposeCards();
      disposeRenderer(renderer);
    },
  };
}
