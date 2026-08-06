import { CAR_Z, MIN_PICKUP_SEPARATION } from './constants';

// Pushes a candidate spawn distance further out if it would land too close
// to the other pickup stream's current position, so a green pickup and a
// red hazard never end up spawning right on top of each other.
export function keepClearOfPeer(aheadDistance: number, getPeerZ: (() => number) | null): number {
  if (!getPeerZ) return aheadDistance;
  const candidateZ = CAR_Z - aheadDistance;
  const diff = Math.abs(candidateZ - getPeerZ());
  if (diff < MIN_PICKUP_SEPARATION) {
    return aheadDistance + (MIN_PICKUP_SEPARATION - diff);
  }
  return aheadDistance;
}
