import * as THREE from 'three';
import roadTextureUrl from '../assets/road3-rotated.png';
import { GREEN_BELT_WIDTH, ROAD_LENGTH, ROAD_TEXTURE_TILE_LENGTH, ROAD_WIDTH } from './constants';

const SHOULDER_WIDTH = 60; // total ground width dressed on each side of the road

export interface Road {
  mesh: THREE.Mesh;
  update(distanceDelta: number): void;
}

export function createRoad(scene: THREE.Scene): Road {
  const texture = new THREE.TextureLoader().load(roadTextureUrl);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, ROAD_LENGTH / ROAD_TEXTURE_TILE_LENGTH);
  texture.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.z = -ROAD_LENGTH / 2 + 40;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // A grass belt hugs the road, then the ground turns to concrete plaza
  // further out, under the buildings (see decor.ts for their placement).
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x3f8a4d, roughness: 1 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xaeac9e, roughness: 0.95 });
  const concreteWidth = SHOULDER_WIDTH - GREEN_BELT_WIDTH;
  for (const side of [-1, 1]) {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(GREEN_BELT_WIDTH, ROAD_LENGTH), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(side * (ROAD_WIDTH / 2 + GREEN_BELT_WIDTH / 2), -0.01, mesh.position.z);
    grass.receiveShadow = true;
    scene.add(grass);

    const concrete = new THREE.Mesh(new THREE.PlaneGeometry(concreteWidth, ROAD_LENGTH), concreteMat);
    concrete.rotation.x = -Math.PI / 2;
    concrete.position.set(side * (ROAD_WIDTH / 2 + GREEN_BELT_WIDTH + concreteWidth / 2), -0.01, mesh.position.z);
    concrete.receiveShadow = true;
    scene.add(concrete);
  }

  return {
    mesh,
    update(distanceDelta: number) {
      texture.offset.y -= distanceDelta / ROAD_TEXTURE_TILE_LENGTH;
    },
  };
}
