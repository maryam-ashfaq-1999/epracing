import { pickups } from './pickups';

export const LANES = 3;
export const LANE_WIDTH = 3.2;
export const ROAD_WIDTH = LANE_WIDTH * LANES;

export function laneCenterX(lane: number): number {
  return -ROAD_WIDTH / 2 + LANE_WIDTH * (lane + 0.5);
}

// World forward is -Z. The car and camera stay fixed at Z = 0 forever; the
// world scrolls toward them instead (road texture offset + moving props),
// which sidesteps floating-point drift over a long session entirely.
export const CAR_Z = 0;

export const BASE_SPEED = 20; // units/second
export const MAX_SPEED = 46;
export const SPEED_RAMP = 0.7; // units/second gained per second of play
export const LANE_CHANGE_EASE = 8; // higher = snappier lane switch

export const ROAD_LENGTH = 400;
export const ROAD_TEXTURE_TILE_LENGTH = 8; // world units per texture repeat along the road

// Width of the grass shoulder immediately beside the road, before the ground
// turns to concrete under the buildings further out (see road.ts / decor.ts).
export const GREEN_BELT_WIDTH = 14;

export const DECOR_RANGE = 320; // total length of the recycling loop for roadside cubes
export const DECOR_SPACING = 16;
export const DECOR_RECYCLE_Z = 8; // just behind the camera

// Only one collectible is ever active - once it's caught or missed, the next
// one spawns this far ahead (plus a little randomness) rather than a dense
// field of items scrolling in at once.
export const COLLECT_GAP = 28;
export const COLLECT_GAP_JITTER = 9;
export const COLLECT_CATCH_DISTANCE = 1.6;
export const COLLECT_RECYCLE_Z = 6;

// Hazards to avoid - spaced further apart than the green pickups so there
// are fewer of them over the course of a race.
export const HAZARD_GAP = 95;
export const HAZARD_GAP_JITTER = 26;
export const HAZARD_LABELS = ['angry customers', 'missed SLAs', 'low synergy', 'no teamwork'];
export const MAX_STRIKES = 3;

// Minimum world-distance kept between the active green pickup and the
// active red hazard so a freshly spawned item never lands right on top of
// the other one.
export const MIN_PICKUP_SEPARATION = 12;

export const RACE_DURATION_SECONDS = 60;
export const FINISH_DECEL = 14; // units/second^2 braking toward a stop at the finish line

// Distance the car actually covers in RACE_DURATION_SECONDS given the speed
// ramp, computed analytically (piecewise: ramping, then capped at max) so
// the finish line can be placed once at game start and simply scroll in
// with everything else - no need to watch a clock separately.
function computeFinishDistance(durationSeconds: number): number {
  const rampTime = Math.min(durationSeconds, (MAX_SPEED - BASE_SPEED) / SPEED_RAMP);
  const rampDistance = BASE_SPEED * rampTime + 0.5 * SPEED_RAMP * rampTime * rampTime;
  const remainingTime = durationSeconds - rampTime;
  return rampDistance + MAX_SPEED * remainingTime;
}

export const FINISH_DISTANCE = computeFinishDistance(RACE_DURATION_SECONDS);

// Each pickup label in pickups.ts spawns at most once per race (see
// collectibles.ts), so this is an exact cap, not an estimate - used for
// classifying leaderboard scores into tiers.
export const MAX_STARS = pickups.length;

export interface MilestoneDef {
  distanceFraction: number; // fraction of FINISH_DISTANCE
  label: string; // shown as the glowing on-screen banner
  badgeLabel: string; // shown on the accumulated badge
}

// Evenly spaced along the race distance (not wall-clock time - see
// FINISH_DISTANCE above for why distance-based markers are more robust).
export const MILESTONES: MilestoneDef[] = [
  { distanceFraction: 0.20, label: '30 Mil MAUs', badgeLabel: '30M' },
  { distanceFraction: 0.40, label: '40 Mil MAUs', badgeLabel: '40M' },
  { distanceFraction: 0.60, label: '50 Mil MAUs', badgeLabel: '50M' },
  { distanceFraction: 0.80, label: '60 Mil MAUs', badgeLabel: '60M' },
];

export const CAMERA_HEIGHT = 3.2;
export const CAMERA_BACK = 7.5;
export const CAMERA_FOV = 62;
export const CAMERA_LOOK_AHEAD = 14;
export const CAMERA_LOOK_HEIGHT = 1.2;
