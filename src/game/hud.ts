export interface Hud {
  setStars(count: number): void;
  setProgress(fraction: number): void;
  setPaused(paused: boolean): void;
  spawnPopup(text: string): void;
  showFinish(starCount: number): void;
  showMilestone(text: string): void;
  addBadge(label: string): void;
  addStrike(): void;
  flashHit(): void;
  showLose(): void;
  onLeft(cb: () => void): void;
  onRight(cb: () => void): void;
  onPauseToggle(cb: () => void): void;
  onRetry(cb: () => void): void;
}

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

const SWIPE_THRESHOLD_PX = 40;

// Lets a horizontal drag anywhere on the game canvas trigger the same lane
// change as tapping the arrow buttons - one lane change per swipe, ignoring
// mostly-vertical drags so scrolling gestures don't misfire.
function setupSwipe(target: HTMLElement, onLeft: () => void, onRight: () => void): void {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let handled = false;

  target.addEventListener('pointerdown', (e) => {
    tracking = true;
    handled = false;
    startX = e.clientX;
    startY = e.clientY;
  });
  target.addEventListener('pointermove', (e) => {
    if (!tracking || handled) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      handled = true;
      if (dx < 0) onLeft();
      else onRight();
    }
  });
  target.addEventListener('pointerup', () => {
    tracking = false;
  });
  target.addEventListener('pointercancel', () => {
    tracking = false;
  });
}

export function createHud(): Hud {
  const progressPct = byId<HTMLDivElement>('progressPct');
  const progressFill = byId<HTMLDivElement>('progressFill');
  const starCount = byId<HTMLSpanElement>('starCount');
  const pauseBtn = byId<HTMLButtonElement>('pauseBtn');
  const pausedOverlay = byId<HTMLDivElement>('pausedOverlay');
  const popupLayer = byId<HTMLDivElement>('popupLayer');
  const leftBtn = byId<HTMLButtonElement>('leftBtn');
  const rightBtn = byId<HTMLButtonElement>('rightBtn');
  const canvasHost = byId<HTMLDivElement>('canvasHost');
  const finishOverlay = byId<HTMLDivElement>('finishOverlay');
  const finalStarCount = byId<HTMLSpanElement>('finalStarCount');
  const retryBtn = byId<HTMLButtonElement>('retryBtn');
  const milestoneBanner = byId<HTMLDivElement>('milestoneBanner');
  const badgeBar = byId<HTMLDivElement>('badgeBar');
  const strikeBar = byId<HTMLDivElement>('strikeBar');
  const hitFlash = byId<HTMLDivElement>('hitFlash');
  const loseOverlay = byId<HTMLDivElement>('loseOverlay');
  const loseRetryBtn = byId<HTMLButtonElement>('loseRetryBtn');

  let leftCb: () => void = () => {};
  let rightCb: () => void = () => {};
  setupSwipe(canvasHost, () => leftCb(), () => rightCb());

  return {
    setStars(count: number) {
      starCount.textContent = `${count}`;
    },
    setProgress(fraction: number) {
      const pct = Math.max(0, Math.min(1, fraction));
      progressPct.textContent = `${Math.round(pct * 100)}%`;
      progressFill.style.width = `${pct * 100}%`;
    },
    setPaused(paused: boolean) {
      pauseBtn.textContent = paused ? '▶' : '❚❚';
      pausedOverlay.classList.toggle('hidden', !paused);
    },
    spawnPopup(text: string) {
      const el = document.createElement('div');
      el.className = 'popup';
      el.textContent = text;
      popupLayer.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    },
    showFinish(count: number) {
      finalStarCount.textContent = `${count}`;
      finishOverlay.classList.remove('hidden');
    },
    showMilestone(text: string) {
      milestoneBanner.textContent = text;
      milestoneBanner.classList.remove('show');
      // Force a reflow so re-triggering the class restarts the CSS animation.
      void milestoneBanner.offsetWidth;
      milestoneBanner.classList.add('show');
    },
    addBadge(label: string) {
      const el = document.createElement('div');
      el.className = 'badge';
      el.textContent = label;
      badgeBar.appendChild(el);
    },
    addStrike() {
      const el = document.createElement('div');
      el.className = 'strike';
      el.textContent = '✕';
      strikeBar.appendChild(el);
    },
    flashHit() {
      hitFlash.classList.remove('flash');
      // Force a reflow so re-triggering the class restarts the CSS animation.
      void hitFlash.offsetWidth;
      hitFlash.classList.add('flash');
    },
    showLose() {
      loseOverlay.classList.remove('hidden');
    },
    onLeft(cb) {
      leftCb = cb;
      leftBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        cb();
      });
    },
    onRight(cb) {
      rightCb = cb;
      rightBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        cb();
      });
    },
    onPauseToggle(cb) {
      pauseBtn.addEventListener('click', cb);
    },
    onRetry(cb) {
      retryBtn.addEventListener('click', cb);
      loseRetryBtn.addEventListener('click', cb);
    },
  };
}
