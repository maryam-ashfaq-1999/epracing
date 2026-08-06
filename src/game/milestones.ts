import * as THREE from 'three';
import { createCheckerTexture } from './checkerTexture';
import { CAR_Z, FINISH_DISTANCE, MILESTONES, MilestoneDef, ROAD_WIDTH } from './constants';

export interface Milestones {
  update(distanceDelta: number, onCross: (milestone: MilestoneDef) => void): void;
}

const MARKER_LENGTH = 1.6;

interface Marker {
  mesh: THREE.Mesh;
  def: MilestoneDef;
  triggered: boolean;
}

export function createMilestones(scene: THREE.Scene): Milestones {
  const texture = createCheckerTexture('#ffd35c', '#7a4b00');
  const geometry = new THREE.PlaneGeometry(ROAD_WIDTH, MARKER_LENGTH);

  const markers: Marker[] = MILESTONES.map((def) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, 0.018, CAR_Z - FINISH_DISTANCE * def.distanceFraction);
    scene.add(mesh);
    return { mesh, def, triggered: false };
  });

  return {
    update(distanceDelta, onCross) {
      for (const marker of markers) {
        marker.mesh.position.z += distanceDelta;
        if (!marker.triggered && marker.mesh.position.z >= CAR_Z) {
          marker.triggered = true;
          onCross(marker.def);
        }
      }
    },
  };
}
