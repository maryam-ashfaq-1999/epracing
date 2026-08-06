import * as THREE from 'three';
import { SkyscraperGenerator } from 'three/addons/generators/city/SkyscraperGenerator.js';

// SkyscraperGenerator bakes real facade detail (piers, windows, cornices,
// finials) into plain BufferGeometry - passing our own MeshStandardMaterial
// (instead of leaving it null) keeps everything on the classic WebGLRenderer
// path already used everywhere else in this game, no WebGPU/node materials.
const BUILDING_COLORS = [0xb9c2d8, 0xd9a066, 0x8fa38c, 0xc9b8a3, 0x9fb3c8, 0xcfa5a0];

interface BuildingSpec {
  seed: number;
  totalHeight: number;
  width: number;
  depth: number;
}

const BUILDING_SPECS: BuildingSpec[] = [
  { seed: 11, totalHeight: 34, width: 12, depth: 10 },
  { seed: 27, totalHeight: 48, width: 16, depth: 12 },
  { seed: 53, totalHeight: 60, width: 14, depth: 18 },
  { seed: 8, totalHeight: 72, width: 18, depth: 14 },
  { seed: 91, totalHeight: 40, width: 10, depth: 10 },
  { seed: 64, totalHeight: 90, width: 20, depth: 16 },
];

export interface BuildingVariant {
  // A template Mesh, never added to a scene itself - callers clone() it per
  // placement so every instance shares one baked geometry + material instead
  // of re-running the generator (which is comparatively expensive).
  template: THREE.Mesh;
  halfWidth: number; // for keeping placements clear of the road
}

// Built once per game session - each generator run bakes a fair amount of
// geometry, so a small shared pool (cloned per roadside slot) keeps the
// skyline varied without paying that cost per instance.
export function createBuildingPool(): BuildingVariant[] {
  return BUILDING_SPECS.map((spec, i) => {
    const material = new THREE.MeshStandardMaterial({
      color: BUILDING_COLORS[i % BUILDING_COLORS.length],
      roughness: 0.85,
    });
    const generator = new SkyscraperGenerator(
      { seed: spec.seed, totalHeight: spec.totalHeight, footprint: { width: spec.width, depth: spec.depth } },
      material,
    );
    const template = generator.build();
    template.castShadow = true;
    template.receiveShadow = true;
    return { template, halfWidth: Math.max(spec.width, spec.depth) / 2 };
  });
}
