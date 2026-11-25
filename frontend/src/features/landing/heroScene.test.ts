import { Mesh, MeshBasicMaterial, type Object3D, type Scene } from "three";
import { describe, expect, it, vi } from "vitest";
import { HERO_SAMPLE_CARDS, HERO_TIMING } from "./hero";
import { heroFrameAt } from "./heroCycle";
import { createHeroScene } from "./heroScene";

const rendered: Scene[] = [];

// jsdom has no WebGL: only the renderer is stubbed, the scene graph is real three.js.
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class WebGLRenderer {
    domElement = document.createElement("canvas");
    setPixelRatio() {}
    setSize() {}
    render(scene: Scene) {
      rendered.push(scene);
    }
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer };
});

describe("createHeroScene", () => {
  it("draws every card unlit and adds no light, so the cards stay flat (ADR 0028 section 2)", () => {
    const cards = HERO_SAMPLE_CARDS.map(() => ({
      canvas: document.createElement("canvas"),
      paint: () => undefined,
    }));
    const scene = createHeroScene(document.createElement("div"), cards, 1);

    scene.render(heroFrameAt(0, HERO_SAMPLE_CARDS, HERO_TIMING), 0, {
      x: 0,
      y: 0,
    });

    const objects: Object3D[] = [];
    rendered[0].traverse((object) => objects.push(object));
    const meshes = objects.filter((object) => object instanceof Mesh);
    expect(meshes).toHaveLength(cards.length);
    for (const mesh of meshes)
      expect(mesh.material).toBeInstanceOf(MeshBasicMaterial);
    expect(objects.filter((object) => "isLight" in object)).toEqual([]);
    scene.dispose();
  });
});
