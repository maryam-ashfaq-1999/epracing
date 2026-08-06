import * as THREE from 'three';
import { createGlowTextTexture, type GlowTextOptions } from './glowTextTexture';

// A single double-sided plane shows its text mirrored once the renderer
// draws its back face mid-spin. Pairing two FrontSide planes back-to-back
// (one rotated 180deg) avoids that - each is only ever drawn while its own
// front face points at the camera, so the label always reads correctly.
export function createSpinningTextMesh(text: string, color: string, height: number, options?: GlowTextOptions): THREE.Group {
  const { texture, aspect } = createGlowTextTexture(text, color, options);
  const geometry = new THREE.PlaneGeometry(height * aspect, height);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });

  const group = new THREE.Group();
  const front = new THREE.Mesh(geometry, material);
  const back = new THREE.Mesh(geometry, material);
  back.rotation.y = Math.PI;
  group.add(front, back);
  return group;
}

// Swaps the label on a group made by createSpinningTextMesh, without
// rebuilding the meshes - the canvas is a fixed size (the font just shrinks
// to fit), so the plane geometry never needs to change, only the texture.
export function updateSpinningTextMesh(group: THREE.Group, text: string, color: string, options?: GlowTextOptions): void {
  const front = group.children[0] as THREE.Mesh;
  const material = front.material as THREE.MeshBasicMaterial;
  const oldTexture = material.map;
  const { texture } = createGlowTextTexture(text, color, options);
  material.map = texture;
  material.needsUpdate = true;
  oldTexture?.dispose();
}
