import * as THREE from 'three';
import { createSpinningTextMesh, updateSpinningTextMesh } from './glowTextMesh';
import {
  CAR_Z,
  COLLECT_CATCH_DISTANCE,
  COLLECT_GAP,
  COLLECT_GAP_JITTER,
  COLLECT_RECYCLE_Z,
  LANES,
  laneCenterX,
} from './constants';
import { pickups } from './pickups';
import { keepClearOfPeer } from './pickupSpacing';

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

// Each pickup label from pickups.ts appears at most once per race, in the
// order they're listed there - once the queue runs out, no more
// collectibles spawn.
export function createCollectibles(scene: THREE.Scene, getPeerZ: (() => number) | null = null): Collectibles {
  const queue = pickups;
  let queueIndex = 0;

  const group = createSpinningTextMesh(queue[0] ?? '', PICKUP_COLOR, 0.8, PICKUP_TEXT_OPTIONS);
  scene.add(group);

  let lane = 0;
  let collected = false;
  let exhausted = false;

  function respawnAhead(): void {
    if (queueIndex >= queue.length) {
      exhausted = true;
      group.visible = false;
      return;
    }
    updateSpinningTextMesh(group, queue[queueIndex], PICKUP_COLOR, PICKUP_TEXT_OPTIONS);
    queueIndex += 1;

    lane = Math.floor(Math.random() * LANES);
    const aheadDistance = keepClearOfPeer(COLLECT_GAP + Math.random() * COLLECT_GAP_JITTER, getPeerZ);
    group.position.set(laneCenterX(lane), PICKUP_HEIGHT, CAR_Z - aheadDistance);
    collected = false;
    group.visible = true;
  }

  respawnAhead();

  return {
    update(_dt, distanceDelta, carLane, onCatch) {
      if (exhausted) return;

      group.position.z += distanceDelta;

      if (!collected) {
        const dz = Math.abs(group.position.z - CAR_Z);
        if (dz < COLLECT_CATCH_DISTANCE && lane === carLane) {
          collected = true;
          group.visible = false;
          onCatch();
        }
      }

      if (group.position.z > COLLECT_RECYCLE_Z) {
        respawnAhead();
      }
    },
    hide() {
      group.visible = false;
    },
    getActiveZ() {
      return group.position.z;
    },
  };
}
