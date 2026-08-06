import * as THREE from 'three';
import { createBuildingPool } from './cityBuildings';
import { DECOR_RANGE, DECOR_RECYCLE_Z, DECOR_SPACING, GREEN_BELT_WIDTH, ROAD_WIDTH } from './constants';

export interface Decor {
  update(distanceDelta: number): void;
}

interface DecorItem {
  mesh: THREE.Mesh;
  side: number;
  laneOffset: number;
}

const TREE_COLORS = [0x275a37, 0x3c8a4a, 0x2e7048];

export function createDecor(scene: THREE.Scene): Decor {
  const items: DecorItem[] = [];
  const count = Math.ceil(DECOR_RANGE / DECOR_SPACING);
  const buildingPool = createBuildingPool();

  for (let i = 0; i < count; i++) {
    for (const side of [-1, 1]) {
      const isBuilding = Math.random() < 0.35;
      const z = -i * DECOR_SPACING - Math.random() * DECOR_SPACING * 0.4;

      if (isBuilding) {
        const variant = buildingPool[Math.floor(Math.random() * buildingPool.length)];
        const mesh = variant.template.clone();
        // Cleared past the green belt so buildings always sit on the concrete
        // plaza, never with their base poking into the grass.
        const laneOffset = ROAD_WIDTH / 2 + GREEN_BELT_WIDTH + 2 + variant.halfWidth + Math.random() * 24;
        mesh.position.set(side * laneOffset, 0, z);
        scene.add(mesh);
        items.push({ mesh, side, laneOffset });
      } else {
        const size = 1 + Math.random() * 1.4;
        const height = size * (1.4 + Math.random() * 0.6);
        const color = TREE_COLORS[Math.floor(Math.random() * TREE_COLORS.length)];

        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size, height, size),
          new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Kept inside the green belt rather than spilling onto the concrete.
        const laneOffset = ROAD_WIDTH / 2 + 4 + Math.random() * (GREEN_BELT_WIDTH - 4);
        mesh.position.set(side * laneOffset, height / 2, z);
        scene.add(mesh);
        items.push({ mesh, side, laneOffset });
      }
    }
  }

  return {
    update(distanceDelta: number) {
      for (const item of items) {
        item.mesh.position.z += distanceDelta;
        if (item.mesh.position.z > DECOR_RECYCLE_Z) {
          item.mesh.position.z -= DECOR_RANGE;
        }
      }
    },
  };
}
