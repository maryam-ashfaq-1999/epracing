import * as THREE from 'three';
import skylineUrl from '../assets/skyline.png';
import { CAMERA_FOV } from './constants';

export interface SceneRig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
}

// Hazy blue-grey tone sampled from the skyline photo's distant horizon band,
// so the fog fading out distant road/decor blends into the image instead of
// a mismatched flat color.
export const FOG_COLOR = 0x5a82ad;
const FOG_NEAR = 40;
const FOG_FAR = 220;

// The photo's aspect ratio won't generally match the game's viewport, so the
// background needs a manual "cover" crop (like CSS background-size: cover)
// rather than letting Three.js stretch it to the canvas and distort it.
function fitBackgroundCover(texture: THREE.Texture, imageAspect: number, canvasAspect: number): void {
  if (canvasAspect > imageAspect) {
    const scale = imageAspect / canvasAspect;
    texture.repeat.set(1, scale);
    texture.offset.set(0, (1 - scale) / 2);
  } else {
    const scale = canvasAspect / imageAspect;
    texture.repeat.set(scale, 1);
    texture.offset.set((1 - scale) / 2, 0);
  }
}

export function createSceneRig(host: HTMLElement): SceneRig {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

  const skylineTexture = new THREE.TextureLoader().load(skylineUrl, (texture) => {
    fitBackgroundCover(texture, texture.image.width / texture.image.height, host.clientWidth / host.clientHeight);
  });
  skylineTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = skylineTexture;

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 500);

  const ambient = new THREE.HemisphereLight(0xcfd6ff, 0x3f8a4d, 1.05);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffdba8, 1.4);
  sun.position.set(-30, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  scene.add(sun);
  scene.add(sun.target);

  function resize(): void {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    if (skylineTexture.image) {
      fitBackgroundCover(skylineTexture, skylineTexture.image.width / skylineTexture.image.height, w / h);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, sun };
}
