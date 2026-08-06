import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import carModelUrl from '../assets/models/car/car.obj';
import carTextureUrl from '../assets/models/car/car.png';
import logoUrl from '../assets/logo.png';
import logoFullUrl from '../assets/logofull.png';
import { CAR_Z, LANES, LANE_CHANGE_EASE, MAX_SPEED, laneCenterX } from './constants';

export interface Car {
  mesh: THREE.Object3D;
  lane: number;
  setLane(lane: number): void;
  update(dt: number, speed: number): void;
}

const TARGET_WIDTH = 1.9; // world units, roughly one traffic-lane-width car

const PLACEHOLDER_WIDTH = 1.8;
const PLACEHOLDER_HEIGHT = 1.1;
const PLACEHOLDER_DEPTH = 2.6;

const LOGO_WIDTH = 0.75; // world units
const LOGO_ASPECT = 816 / 750; // source image height/width
const LOGO_LIFT = 0.012; // sits just above the paint to avoid z-fighting
const LOGO_Z_OFFSET = 0.55; // shifts toward the rear so it sits fully on the roof, not the windshield

// Decal on the rear windshield glass, tuned against this specific car model
// (measured height ~1.32, rear bumper at world Z ~2.0) by test-rendering the
// model alone from a close rear angle and eyeballing the fit against the
// glass's visible bounds.
const REAR_LOGO_WIDTH = 0.55; // world units
const REAR_LOGO_ASPECT = 182 / 320; // source image height/width
const REAR_LOGO_Y = 1.12;
const REAR_LOGO_Z = 1.5;
const REAR_LOGO_TILT_DEG = 60; // leans the decal back to follow the windshield's rake

// Idle engine/suspension motion - two off-ratio sine waves each for bob and
// vibration so the motion doesn't read as a single obvious metronome loop.
const BOB_FREQ_1 = Math.PI * 2 * 1.7;
const BOB_AMP_1 = 0.012;
const BOB_FREQ_2 = Math.PI * 2 * 2.9;
const BOB_AMP_2 = 0.006;
const VIBRATION_FREQ_1 = Math.PI * 2 * 13;
const VIBRATION_FREQ_2 = Math.PI * 2 * 17.3;
const VIBRATION_FREQ_3 = Math.PI * 2 * 11.1;
const VIBRATION_AMP = 0.005;

// Lane-change lean: banks and nudges the nose toward the turn, proportional
// to lateral speed, then eases back to level once the lane change settles.
const MAX_ROLL = 0.12;
const ROLL_FACTOR = 0.03;
const ROLL_EASE = 9;
const MAX_YAW = 0.16;
const YAW_FACTOR = 0.045;
const YAW_EASE = 7;

export function createCar(scene: THREE.Scene): Car {
  const group = new THREE.Group();
  group.position.set(laneCenterX(1), 0, CAR_Z);
  scene.add(group);

  // Cosmetic motion (bob, vibration, turn lean) lives on this inner wrapper
  // so it never disturbs `group`'s position, which the camera follows.
  const visual = new THREE.Group();
  group.add(visual);

  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(PLACEHOLDER_WIDTH, PLACEHOLDER_HEIGHT, PLACEHOLDER_DEPTH),
    new THREE.MeshStandardMaterial({ color: 0xe5e9ef, roughness: 0.5, metalness: 0.15 }),
  );
  placeholder.position.y = PLACEHOLDER_HEIGHT / 2;
  placeholder.castShadow = true;
  placeholder.receiveShadow = true;
  visual.add(placeholder);

  // A thin decal plane resting just above the roof paint, rather than a
  // texture baked into the body material, so it stays crisp regardless of
  // the car model's own UV layout.
  const logoTexture = new THREE.TextureLoader().load(logoUrl);
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  const logoMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(LOGO_WIDTH, LOGO_WIDTH * LOGO_ASPECT),
    new THREE.MeshBasicMaterial({ map: logoTexture, transparent: true, depthWrite: false }),
  );
  logoMesh.rotation.x = -Math.PI / 2;
  logoMesh.renderOrder = 1;
  logoMesh.position.set(0, PLACEHOLDER_HEIGHT + LOGO_LIFT, LOGO_Z_OFFSET);
  visual.add(logoMesh);

  // Same idea, standing upright and tilted back against the rear windshield
  // instead of lying flat on the roof.
  const rearLogoTexture = new THREE.TextureLoader().load(logoFullUrl);
  rearLogoTexture.colorSpace = THREE.SRGBColorSpace;
  const rearLogoMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(REAR_LOGO_WIDTH, REAR_LOGO_WIDTH * REAR_LOGO_ASPECT),
    new THREE.MeshBasicMaterial({ map: rearLogoTexture, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  rearLogoMesh.rotation.x = -THREE.MathUtils.degToRad(REAR_LOGO_TILT_DEG);
  rearLogoMesh.renderOrder = 1;
  rearLogoMesh.position.set(0, REAR_LOGO_Y, REAR_LOGO_Z);
  visual.add(rearLogoMesh);

  const texture = new THREE.TextureLoader().load(carTextureUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, metalness: 0.1 });

  new OBJLoader().load(
    carModelUrl,
    (obj) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Source model is already Y-up, length along local X, width along
      // local Z. Center X/Z and drop the base to y=0 (baked into each
      // mesh's geometry so the group's own rotation/scale below stay
      // pivoted around the car's centerline), then swap X/Z so length
      // ends up facing the camera's forward axis (world Z).
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.translate(-center.x, -box.min.y, -center.z);
          child.material = material;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const scale = TARGET_WIDTH / size.z;
      obj.scale.setScalar(scale);
      obj.rotation.y = -Math.PI / 2;

      visual.remove(placeholder);
      visual.add(obj);
      logoMesh.position.y = size.y * scale + LOGO_LIFT;
    },
    undefined,
    (err) => {
      console.error('Failed to load car model, keeping placeholder cube.', err);
    },
  );

  let lane = 1;
  let runTime = 0;
  let roll = 0;
  let yaw = 0;

  return {
    mesh: group,
    get lane() {
      return lane;
    },
    setLane(next: number) {
      lane = Math.max(0, Math.min(LANES - 1, next));
    },
    update(dt: number, speed: number) {
      const prevX = group.position.x;
      const targetX = laneCenterX(lane);
      group.position.x += (targetX - group.position.x) * Math.min(1, LANE_CHANGE_EASE * dt);
      const lateralVelocity = dt > 0 ? (group.position.x - prevX) / dt : 0;

      runTime += dt;
      const speedFactor = 0.4 + 0.6 * Math.min(1, speed / MAX_SPEED);

      const bob = Math.sin(runTime * BOB_FREQ_1) * BOB_AMP_1 + Math.sin(runTime * BOB_FREQ_2 + 1.3) * BOB_AMP_2;
      const vibrationY = Math.sin(runTime * VIBRATION_FREQ_1) * VIBRATION_AMP + Math.sin(runTime * VIBRATION_FREQ_2) * VIBRATION_AMP * 0.6;
      const vibrationX = Math.sin(runTime * VIBRATION_FREQ_3 + 0.7) * VIBRATION_AMP * 0.5;
      visual.position.y = (bob + vibrationY) * speedFactor;
      visual.position.x = vibrationX * speedFactor;

      // Body roll leans AWAY from the turn (outside suspension compresses
      // under weight transfer), the way a real soft-suspension car does -
      // not banked into it like a motorcycle.
      const targetRoll = THREE.MathUtils.clamp(lateralVelocity * ROLL_FACTOR, -MAX_ROLL, MAX_ROLL);
      roll += (targetRoll - roll) * Math.min(1, ROLL_EASE * dt);
      const targetYaw = THREE.MathUtils.clamp(-lateralVelocity * YAW_FACTOR, -MAX_YAW, MAX_YAW);
      yaw += (targetYaw - yaw) * Math.min(1, YAW_EASE * dt);
      visual.rotation.z = roll;
      visual.rotation.y = yaw;
    },
  };
}
