import * as THREE from 'three';

const CHECKER_COLS = 12;
const CHECKER_ROWS = 2;
const CELL_PX = 24;

export function createCheckerTexture(colorA: string, colorB: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = CELL_PX * CHECKER_COLS;
  canvas.height = CELL_PX * CHECKER_ROWS;
  const ctx = canvas.getContext('2d')!;
  for (let row = 0; row < CHECKER_ROWS; row++) {
    for (let col = 0; col < CHECKER_COLS; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(col * CELL_PX, row * CELL_PX, CELL_PX, CELL_PX);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
