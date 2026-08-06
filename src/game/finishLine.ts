import * as THREE from 'three';
import { createCheckerTexture } from './checkerTexture';
import { CAR_Z, FINISH_DISTANCE, ROAD_WIDTH } from './constants';

export interface FinishLine {
  update(distanceDelta: number): void;
  hasReachedCar(): boolean;
}

const FINISH_LENGTH = 2.2;

export function createFinishLine(scene: THREE.Scene): FinishLine {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_WIDTH, FINISH_LENGTH),
    new THREE.MeshBasicMaterial({ map: createCheckerTexture('#f5f5f5', '#111111') }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.02, CAR_Z - FINISH_DISTANCE);
  scene.add(mesh);

  return {
    update(distanceDelta: number) {
      mesh.position.z += distanceDelta;
    },
    hasReachedCar() {
      return mesh.position.z >= CAR_Z;
    },
  };
}
