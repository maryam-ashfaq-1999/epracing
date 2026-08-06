import * as THREE from 'three';
import { CAR_Z, COLLECT_CATCH_DISTANCE, COLLECT_RECYCLE_Z, HAZARD_GAP, HAZARD_GAP_JITTER, LANES, laneCenterX } from './constants';
import { createSpinningTextMesh } from './glowTextMesh';
import { outages } from './pickups';
import { keepClearOfPeer } from './pickupSpacing';

// pickups.ts lists each label repeated a few times (for weighting elsewhere);
// de-duped here since only one mesh per distinct label is needed, and the
// shuffle-bag picker below already guarantees an even, non-streaky spread
// on its own.
const HAZARD_LABELS = [...new Set(outages)];

export interface Hazards {
  update(dt: number, distanceDelta: number, carLane: number, onHit: () => void): void;
  hide(): void;
  getActiveZ(): number;
}

const HAZARD_HEIGHT = 1.6;
const HAZARD_COLOR = '#ff3b3b';
// Same treatment as the green collectibles: a point larger, and wrapped onto
// two lines (rather than shrunk to fit one) once a label like "angry
// customers" gets too wide.
const HAZARD_TEXT_OPTIONS = { maxFontSize: 73, minFontSize: 37, maxLineWidth: 340, allowWrap: true };

// Cycles through a shuffled copy of the labels so all four show up equally
// often over a race, rather than a plain random pick that can streak.
function createLabelPicker(labels: string[]): () => string {
  let bag: string[] = [];
  return () => {
    if (bag.length === 0) {
      bag = [...labels];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  };
}

export function createHazards(scene: THREE.Scene, getPeerZ: (() => number) | null = null): Hazards {
  const groups = new Map<string, THREE.Group>();
  for (const label of HAZARD_LABELS) {
    const group = createSpinningTextMesh(label, HAZARD_COLOR, 0.8, HAZARD_TEXT_OPTIONS);
    group.visible = false;
    scene.add(group);
    groups.set(label, group);
  }
  const nextLabel = createLabelPicker(HAZARD_LABELS);

  let lane = 0;
  let activeLabel = HAZARD_LABELS[0];
  let collected = false;

  function respawnAhead(): void {
    groups.get(activeLabel)!.visible = false;
    activeLabel = nextLabel();
    lane = Math.floor(Math.random() * LANES);
    const aheadDistance = keepClearOfPeer(HAZARD_GAP + Math.random() * HAZARD_GAP_JITTER, getPeerZ);
    const group = groups.get(activeLabel)!;
    group.position.set(laneCenterX(lane), HAZARD_HEIGHT, CAR_Z - aheadDistance);
    group.visible = true;
    collected = false;
  }

  respawnAhead();

  return {
    update(_dt, distanceDelta, carLane, onHit) {
      const group = groups.get(activeLabel)!;
      group.position.z += distanceDelta;

      if (!collected) {
        const dz = Math.abs(group.position.z - CAR_Z);
        if (dz < COLLECT_CATCH_DISTANCE && lane === carLane) {
          collected = true;
          group.visible = false;
          onHit();
        }
      }

      if (group.position.z > COLLECT_RECYCLE_Z) {
        respawnAhead();
      }
    },
    hide() {
      groups.get(activeLabel)!.visible = false;
    },
    getActiveZ() {
      return groups.get(activeLabel)!.position.z;
    },
  };
}
