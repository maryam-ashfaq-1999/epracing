import * as THREE from 'three';

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 160;
const MAX_FONT_SIZE = 92;
const MIN_FONT_SIZE = 36;
const HORIZONTAL_PADDING = 32;

export interface GlowTextOptions {
  maxFontSize?: number;
  minFontSize?: number;
  // Narrower than the canvas triggers a 2-line wrap for text that doesn't
  // fit, instead of just shrinking the font down to squeeze onto one line.
  maxLineWidth?: number;
  allowWrap?: boolean;
}

function fontString(size: number): string {
  return `800 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

// Splits on whichever word boundary balances the two lines' lengths most
// evenly, rather than always breaking at the midpoint character.
function splitIntoTwoLines(text: string): string[] {
  const words = text.split(' ');
  if (words.length < 2) return [text];

  let bestIndex = 1;
  let bestDiff = Infinity;
  let leftLength = 0;
  for (let i = 0; i < words.length - 1; i++) {
    leftLength += words[i].length + 1;
    const diff = Math.abs(leftLength - (text.length - leftLength));
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i + 1;
    }
  }
  return [words.slice(0, bestIndex).join(' '), words.slice(bestIndex).join(' ')];
}

export interface GlowTextTexture {
  texture: THREE.CanvasTexture;
  aspect: number; // width / height, for sizing the plane that displays it
}

export function createGlowTextTexture(text: string, color: string, options: GlowTextOptions = {}): GlowTextTexture {
  const maxFontSize = options.maxFontSize ?? MAX_FONT_SIZE;
  const minFontSize = options.minFontSize ?? MIN_FONT_SIZE;
  const maxLineWidth = options.maxLineWidth ?? CANVAS_WIDTH - HORIZONTAL_PADDING;
  const allowWrap = options.allowWrap ?? false;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let fontSize = maxFontSize;
  ctx.font = fontString(fontSize);

  let lines = [text];
  if (allowWrap && ctx.measureText(text).width > maxLineWidth) {
    lines = splitIntoTwoLines(text);
  }

  // Shrink until every line fits.
  const widestLine = () => Math.max(...lines.map((line) => ctx.measureText(line).width));
  while (widestLine() > maxLineWidth && fontSize > minFontSize) {
    fontSize -= 4;
    ctx.font = fontString(fontSize);
  }

  const lineHeight = fontSize * 1.15;
  const startY = CANVAS_HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2;

  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.fillStyle = color;
  for (let pass = 0; pass < 3; pass++) {
    lines.forEach((line, i) => ctx.fillText(line, CANVAS_WIDTH / 2, startY + i * lineHeight));
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => ctx.fillText(line, CANVAS_WIDTH / 2, startY + i * lineHeight));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, aspect: CANVAS_WIDTH / CANVAS_HEIGHT };
}
