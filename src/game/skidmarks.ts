import * as THREE from 'three';
import { CAR_Z } from './constants';

export interface SkidMarks {
  spawnAt(worldX: number, turnDir: number): void;
  update(dt: number, distanceDelta: number): void;
}

interface Mark {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  age: number;
  active: boolean;
}

const MARK_WIDTH = 0.24;
const MARK_HEIGHT = 0.06;
const MARK_LENGTH = 1.1;
const WHEEL_TRACK = 1.4; // distance between left/right marks, matches car wheel track
const SPAWN_Z_OFFSET = 1.5; // just under the car's rear wheels
const MARK_LIFETIME = 6; // seconds visible before fully faded
const BASE_OPACITY = 0.55;
const STRAIGHT_JITTER = 0.05; // small random rotation so straight marks don't look stamped
const TURN_ANGLE = 0.22; // extra rotation applied on turn-triggered marks

export function createSkidMarks(scene: THREE.Scene): SkidMarks {
  const pool: Mark[] = [];

  function acquire(): Mark {
    const idle = pool.find((m) => !m.active);
    if (idle) return idle;

    const material = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: BASE_OPACITY,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(MARK_WIDTH, MARK_HEIGHT, MARK_LENGTH), material);
    mesh.visible = false;
    scene.add(mesh);

    const mark: Mark = { mesh, material, age: 0, active: false };
    pool.push(mark);
    return mark;
  }

  function layOne(x: number, z: number, rotation: number): void {
    const mark = acquire();
    mark.mesh.position.set(x, MARK_HEIGHT / 2, z);
    mark.mesh.rotation.y = rotation;
    mark.material.opacity = BASE_OPACITY;
    mark.mesh.visible = true;
    mark.age = 0;
    mark.active = true;
  }

  return {
    spawnAt(worldX: number, turnDir: number) {
      const z = CAR_Z + SPAWN_Z_OFFSET;
      const rotation = turnDir !== 0 ? turnDir * TURN_ANGLE : (Math.random() - 0.5) * STRAIGHT_JITTER;
      layOne(worldX - WHEEL_TRACK / 2, z, rotation);
      layOne(worldX + WHEEL_TRACK / 2, z, rotation);
    },
    update(dt: number, distanceDelta: number) {
      for (const mark of pool) {
        if (!mark.active) continue;
        mark.age += dt;
        mark.mesh.position.z += distanceDelta;

        const t = mark.age / MARK_LIFETIME;
        if (t >= 1) {
          mark.active = false;
          mark.mesh.visible = false;
          continue;
        }
        mark.material.opacity = BASE_OPACITY * (1 - t);
      }
    },
  };
}
