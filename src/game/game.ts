import * as THREE from 'three';
import { createCar } from './car';
import { createCollectibles } from './collectibles';
import {
  BASE_SPEED,
  CAMERA_BACK,
  CAMERA_HEIGHT,
  CAMERA_LOOK_AHEAD,
  CAMERA_LOOK_HEIGHT,
  CAR_Z,
  FINISH_DECEL,
  FINISH_DISTANCE,
  MAX_SPEED,
  MAX_STRIKES,
  SPEED_RAMP,
  laneCenterX,
} from './constants';
import { createDecor } from './decor';
import { createFinishLine } from './finishLine';
import { createHazards } from './hazards';
import { createHud } from './hud';
import { createMilestones } from './milestones';
import { createRoad } from './road';
import { createSceneRig } from './scene';
import { createSkidMarks } from './skidmarks';

const STRAIGHT_SKID_MIN = 1;
const STRAIGHT_SKID_MAX = 3;
const LANE_SETTLED_THRESHOLD = 0.05;
const STOPPED_SPEED_THRESHOLD = 0.05;
const PROGRESS_UPDATE_INTERVAL_MS = 4000;
const HIT_SHAKE_DURATION = 0.35; // seconds the camera shakes for after hitting a hazard
const HIT_SHAKE_MAGNITUDE = 0.4; // world units of max camera offset at the start of the shake

function randomStraightSkidDelay(): number {
  return STRAIGHT_SKID_MIN + Math.random() * (STRAIGHT_SKID_MAX - STRAIGHT_SKID_MIN);
}

export interface RaceEndResult {
  outcome: 'finished' | 'lost';
  stars: number;
  strikes: number;
  distanceFraction: number;
  timeMs: number;
}

export interface RaceProgress {
  stars: number;
  strikes: number;
  distanceFraction: number;
}

export interface StartGameOptions {
  // When true, the car sits idle (like paused) until triggerStart() is
  // called on the returned controller - used to hold the car until the
  // player has entered a name and clicked Start.
  waitForStart?: boolean;
  onRaceEnd?: (result: RaceEndResult) => void;
  // Fired at a throttled interval while racing, so an abandoned run (tab
  // closed, never reaches a finish or loss) still has a recent checkpoint
  // recorded even though onRaceEnd never fires for it.
  onProgressUpdate?: (progress: RaceProgress) => void;
}

export interface GameController {
  triggerStart(): void;
}

export function startGame(host: HTMLElement, options: StartGameOptions = {}): GameController {
  const { waitForStart = false, onRaceEnd, onProgressUpdate } = options;
  const { renderer, scene, camera } = createSceneRig(host);
  const road = createRoad(scene);
  const decor = createDecor(scene);
  // Collectibles are all laid out up front (see collectibles.ts), so hazards
  // can just ask it directly where the nearest one still ahead is, to spawn
  // clear of it.
  const collectibles = createCollectibles(scene);
  const hazards = createHazards(scene, () => collectibles.getActiveZ());
  const car = createCar(scene);
  const skidMarks = createSkidMarks(scene);
  const finishLine = createFinishLine(scene);
  const milestones = createMilestones(scene);
  const hud = createHud();

  let speed = BASE_SPEED;
  let starCount = 0;
  let strikeCount = 0;
  let distanceTraveled = 0;
  let paused = false;
  let finished = false; // crossed the finish line, now braking to a stop
  let stopped = false; // fully stopped or lost, score/lose screen shown
  let lost = false; // hit 3 hazards, game over
  let started = !waitForStart;
  let raceStartTimestamp: number | null = started ? Date.now() : null;
  let straightSkidTimer = randomStraightSkidDelay();
  let lastProgressUpdateAt = 0;
  let shakeTimer = 0;

  function raceResult(outcome: 'finished' | 'lost'): RaceEndResult {
    return {
      outcome,
      stars: starCount,
      strikes: strikeCount,
      distanceFraction: distanceTraveled / FINISH_DISTANCE,
      timeMs: raceStartTimestamp ? Date.now() - raceStartTimestamp : 0,
    };
  }

  function shiftLane(dir: number): void {
    if (paused || finished || lost) return;
    const prevLane = car.lane;
    car.setLane(car.lane + dir);
    if (car.lane !== prevLane) {
      skidMarks.spawnAt(car.mesh.position.x, dir);
      straightSkidTimer = randomStraightSkidDelay();
    }
  }

  function togglePause(): void {
    paused = !paused;
    hud.setPaused(paused);
  }

  hud.onLeft(() => shiftLane(-1));
  hud.onRight(() => shiftLane(1));
  hud.onPauseToggle(togglePause);
  hud.onRetry(() => window.location.reload());

  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') shiftLane(-1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') shiftLane(1);
    if (e.code === 'Space' || e.code === 'KeyP') togglePause();
  });

  const cameraTarget = new THREE.Vector3();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = paused || lost || !started ? 0 : Math.min(clock.getDelta(), 1 / 30);

    if (!finished) {
      speed = Math.min(MAX_SPEED, speed + SPEED_RAMP * dt);
      if (finishLine.hasReachedCar()) {
        finished = true;
        collectibles.hide();
        hazards.hide();
      }
    } else {
      speed = Math.max(0, speed - FINISH_DECEL * dt);
    }
    const distanceDelta = speed * dt;
    distanceTraveled = Math.min(FINISH_DISTANCE, distanceTraveled + distanceDelta);
    hud.setProgress(distanceTraveled / FINISH_DISTANCE);

    if (onProgressUpdate && started && !stopped) {
      const now = performance.now();
      if (now - lastProgressUpdateAt >= PROGRESS_UPDATE_INTERVAL_MS) {
        lastProgressUpdateAt = now;
        onProgressUpdate({
          stars: starCount,
          strikes: strikeCount,
          distanceFraction: distanceTraveled / FINISH_DISTANCE,
        });
      }
    }

    car.update(dt, speed);
    road.update(distanceDelta);
    decor.update(distanceDelta);
    skidMarks.update(dt, distanceDelta);
    finishLine.update(distanceDelta);
    milestones.update(distanceDelta, (milestone) => {
      hud.showMilestone(milestone.label);
      hud.addBadge(milestone.badgeLabel);
    });
    if (!finished) {
      collectibles.update(dt, distanceDelta, car.lane, () => {
        starCount += 1;
        hud.setStars(starCount);
        hud.spawnPopup('+1');
      });
      hazards.update(dt, distanceDelta, car.lane, () => {
        strikeCount += 1;
        hud.addStrike();
        hud.flashHit();
        shakeTimer = HIT_SHAKE_DURATION;
        if (strikeCount >= MAX_STRIKES) {
          lost = true;
          stopped = true;
          hud.showLose();
          onRaceEnd?.(raceResult('lost'));
        }
      });
    }

    if (!paused && !finished && !lost) {
      const settled = Math.abs(car.mesh.position.x - laneCenterX(car.lane)) < LANE_SETTLED_THRESHOLD;
      straightSkidTimer -= dt;
      if (settled && straightSkidTimer <= 0) {
        skidMarks.spawnAt(car.mesh.position.x, 0);
        straightSkidTimer = randomStraightSkidDelay();
      }
    }

    if (finished && !stopped && speed <= STOPPED_SPEED_THRESHOLD) {
      stopped = true;
      hud.showFinish(starCount);
      onRaceEnd?.(raceResult('finished'));
    }

    camera.position.set(car.mesh.position.x, CAMERA_HEIGHT, CAR_Z + CAMERA_BACK);
    cameraTarget.set(car.mesh.position.x, CAMERA_LOOK_HEIGHT, CAR_Z - CAMERA_LOOK_AHEAD);
    camera.lookAt(cameraTarget);

    if (shakeTimer > 0) {
      shakeTimer = Math.max(0, shakeTimer - dt);
      const strength = (shakeTimer / HIT_SHAKE_DURATION) * HIT_SHAKE_MAGNITUDE;
      camera.position.x += (Math.random() * 2 - 1) * strength;
      camera.position.y += (Math.random() * 2 - 1) * strength * 0.6;
    }

    renderer.render(scene, camera);
  });

  hud.setStars(starCount);

  return {
    triggerStart() {
      if (started) return;
      started = true;
      raceStartTimestamp = Date.now();
    },
  };
}
