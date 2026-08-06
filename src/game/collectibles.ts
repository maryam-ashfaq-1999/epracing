import * as THREE from 'three';
import { createSpinningTextMesh } from './glowTextMesh';
import { CAR_Z, COLLECT_CATCH_DISTANCE, COLLECT_GAP, LANES, laneCenterX } from './constants';
import { pickups } from './pickups';

export interface Collectibles {
  update(dt: number, distanceDelta: number, carLane: number, onCatch: () => void): void;
  hide(): void;
  getActiveZ(): number;
}

const PICKUP_HEIGHT = 1.6;
const PICKUP_COLOR = '#39ff6a';
// One point larger than the shared default, and wrapped onto two lines
// (rather than shrunk to fit one) once a label like "100% Digital Self
// Service" gets too wide - keeps long pickup labels legible at speed.
const PICKUP_TEXT_OPTIONS = { maxFontSize: 67, minFontSize: 37, maxLineWidth: 340, allowWrap: true };
const START_OFFSET = 20; // world units ahead of the car before the first collectible

interface PlacedPickup {
  group: THREE.Group;
  lane: number;
  caught: boolean;
}

// Every pickup label from pickups.ts is laid out ahead of the car at once,
// evenly spaced by COLLECT_GAP, rather than spawning the next one only once
// the previous is caught or passed - the whole run's collectibles exist
// from the start, each shown exactly once.
export function createCollectibles(scene: THREE.Scene): Collectibles {
  const items: PlacedPickup[] = pickups.map((text, i) => {
    const group = createSpinningTextMesh(text, PICKUP_COLOR, 0.8, PICKUP_TEXT_OPTIONS);
    const lane = Math.floor(Math.random() * LANES);
    group.position.set(laneCenterX(lane), PICKUP_HEIGHT, CAR_Z - START_OFFSET - i * COLLECT_GAP);
    scene.add(group);
    return { group, lane, caught: false };
  });

  return {
    update(_dt, distanceDelta, carLane, onCatch) {
      for (const item of items) {
        if (item.caught) continue;
        item.group.position.z += distanceDelta;

        const dz = Math.abs(item.group.position.z - CAR_Z);
        if (dz < COLLECT_CATCH_DISTANCE && item.lane === carLane) {
          item.caught = true;
          item.group.visible = false;
          onCatch();
        }
      }
    },
    hide() {
      for (const item of items) item.group.visible = false;
    },
    getActiveZ() {
      // Nearest not-yet-caught item still ahead of the car, so hazards can
      // keep clear of it.
      let nearestZ = CAR_Z;
      let nearestDist = Infinity;
      for (const item of items) {
        if (item.caught) continue;
        const d = CAR_Z - item.group.position.z;
        if (d >= 0 && d < nearestDist) {
          nearestDist = d;
          nearestZ = item.group.position.z;
        }
      }
      return nearestZ;
    },
  };
}
