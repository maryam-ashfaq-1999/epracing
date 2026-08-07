import { startGame, type GameController, type RaceEndResult, type RaceProgress } from '../game/game';
import { whenReady } from '../multiplayer/firebase';
import {
  clearLeaderboard,
  createRaceEntry,
  fetchLeaderboard,
  submitScore,
  updateRaceEntry,
  type LeaderboardEntry,
} from '../multiplayer/leaderboard';
import { renderScoreChart } from './scoreChart';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

function cell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function showError(el: HTMLElement, message: string): void {
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearError(el: HTMLElement): void {
  el.classList.add('hidden');
}

function showStatus(el: HTMLElement, message: string): void {
  el.textContent = message;
  el.classList.remove('hidden');
}

function randomGuestName(): string {
  const number = Math.floor(100 + Math.random() * 900);
  return `Player ${number}`;
}

// Compact relative time ("2m ago", "3h ago") so the column stays narrow;
// falls back to a short date once it's more than a week old.
function formatTimestamp(date: Date | null): string {
  if (!date) return '—';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderLeaderboard(tbody: HTMLTableSectionElement, entries: LeaderboardEntry[]): void {
  tbody.replaceChildren();
  for (const entry of entries) {
    const tr = document.createElement('tr');
    const outcomeText = entry.outcome === 'finished' ? 'Finished' : entry.outcome === 'lost' ? 'Lost' : 'Unfinished';
    const outcomeClass =
      entry.outcome === 'finished' ? 'outcome-finished' : entry.outcome === 'lost' ? 'outcome-lost' : 'outcome-unfinished';
    tr.appendChild(cell(entry.name));
    tr.appendChild(cell(outcomeText, outcomeClass));
    tr.appendChild(cell(String(entry.stars)));
    tr.appendChild(cell(String(entry.strikes)));
    tr.appendChild(cell(formatTimestamp(entry.createdAt)));
    tbody.appendChild(tr);
  }
}

export async function startApp(): Promise<void> {
  const canvasHost = byId<HTMLDivElement>('canvasHost');

  const raceProgressLabel = byId<HTMLDivElement>('raceProgressLabel');
  const startDialogTitle = byId<HTMLDivElement>('startDialogTitle');

  const startDialog = byId<HTMLDivElement>('startDialog');
  const playerNameInput = byId<HTMLInputElement>('playerNameInput');
  const startDialogError = byId<HTMLDivElement>('startDialogError');
  const startRaceBtn = byId<HTMLButtonElement>('startRaceBtn');

  const viewLeaderboardBtn = byId<HTMLButtonElement>('viewLeaderboardBtn');
  const loseViewLeaderboardBtn = byId<HTMLButtonElement>('loseViewLeaderboardBtn');

  const leaderboardOverlay = byId<HTMLDivElement>('leaderboardOverlay');
  const leaderboardLoading = byId<HTMLDivElement>('leaderboardLoading');
  const leaderboardTableSection = byId<HTMLDivElement>('leaderboardTableSection');
  const menuLeaderboardBody = byId<HTMLTableSectionElement>('menuLeaderboardBody');
  const leaderboardError = byId<HTMLDivElement>('leaderboardError');
  const leaderboardStatus = byId<HTMLDivElement>('leaderboardStatus');
  const closeLeaderboardBtn = byId<HTMLButtonElement>('closeLeaderboardBtn');
  const clearLeaderboardBtn = byId<HTMLButtonElement>('clearLeaderboardBtn');

  const scoreDistributionOverlay = byId<HTMLDivElement>('scoreDistributionOverlay');
  const scoreChart = byId<HTMLDivElement>('scoreChart');
  const scoreDistributionError = byId<HTMLDivElement>('scoreDistributionError');
  const closeScoreDistributionBtn = byId<HTMLButtonElement>('closeScoreDistributionBtn');
  const scoreDistViewLeaderboardBtn = byId<HTMLButtonElement>('scoreDistViewLeaderboardBtn');
  const clearPasscodeSection = byId<HTMLDivElement>('clearPasscodeSection');
  const clearPasscodeInput = byId<HTMLInputElement>('clearPasscodeInput');
  const clearPasscodeError = byId<HTMLDivElement>('clearPasscodeError');
  const confirmClearBtn = byId<HTMLButtonElement>('confirmClearBtn');
  const cancelClearBtn = byId<HTMLButtonElement>('cancelClearBtn');
  const CLEAR_PASSCODE = 'delete';

  let playerName = '';
  // Set the moment the race starts (see startRaceBtn below) so an abandoned
  // run - one that never reaches onRaceEnd - still has a checkpointed
  // 'unfinished' entry in the leaderboard instead of no record at all.
  let currentEntryId: string | null = null;

  // The car sits parked (waitForStart) until the player clicks Start in the
  // centered dialog - the game/canvas is visible immediately behind it
  // either way, matching "just see the game" rather than a blank loading
  // screen.
  const gameController: GameController = startGame(canvasHost, {
    waitForStart: true,
    onRaceEnd: (result) => void handleRaceEnd(result),
    onProgressUpdate: (progress) => void handleProgressUpdate(progress),
  });

  async function showLeaderboard(): Promise<void> {
    leaderboardOverlay.classList.remove('hidden');
    clearError(leaderboardError);
    leaderboardStatus.classList.add('hidden');
    resetClearPasscode();
    leaderboardTableSection.classList.add('hidden');
    leaderboardLoading.classList.remove('hidden');
    try {
      const entries = await fetchLeaderboard();
      renderLeaderboard(menuLeaderboardBody, entries);
    } catch (err) {
      showError(leaderboardError, 'Could not load the leaderboard.');
      console.error(err);
    } finally {
      leaderboardLoading.classList.add('hidden');
      leaderboardTableSection.classList.remove('hidden');
    }
  }

  async function showScoreDistribution(): Promise<void> {
    scoreDistributionOverlay.classList.remove('hidden');
    clearError(scoreDistributionError);
    try {
      const entries = await fetchLeaderboard();
      renderScoreChart(scoreChart, entries);
    } catch (err) {
      showError(scoreDistributionError, 'Could not load the score distribution.');
      console.error(err);
    }
  }

  async function handleProgressUpdate(progress: RaceProgress): Promise<void> {
    if (!currentEntryId) return;
    try {
      await updateRaceEntry(currentEntryId, { outcome: 'unfinished', timeMs: null, ...progress });
    } catch (err) {
      console.error('Failed to checkpoint race progress', err);
    }
  }

  async function handleRaceEnd(result: RaceEndResult): Promise<void> {
    try {
      if (currentEntryId) {
        await updateRaceEntry(currentEntryId, result);
      } else {
        await submitScore(playerName, result);
      }
    } catch (err) {
      console.error('Failed to submit score', err);
    }
    // The finish/lose overlay (already shown by the game itself) carries the
    // score and Retry button; the leaderboard now surfaces on top of it so
    // the player immediately sees where that run ranks.
    void showLeaderboard();
  }

  startRaceBtn.disabled = true;
  try {
    await whenReady;
  } catch (err) {
    showError(startDialogError, 'Could not connect. Please refresh and try again.');
    console.error(err);
    return;
  }
  startRaceBtn.disabled = false;

  startRaceBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || randomGuestName();
    clearError(startDialogError);
    playerName = name;
    raceProgressLabel.textContent = `Race Progress - ${name}`;
    startDialog.classList.add('hidden');
    gameController.triggerStart();
    void (async () => {
      try {
        currentEntryId = await createRaceEntry(playerName);
      } catch (err) {
        console.error('Failed to create leaderboard entry', err);
      }
    })();
  });

  viewLeaderboardBtn.addEventListener('click', () => void showLeaderboard());
  loseViewLeaderboardBtn.addEventListener('click', () => void showLeaderboard());
  scoreDistViewLeaderboardBtn.addEventListener('click', () => {
    scoreDistributionOverlay.classList.add('hidden');
    void showLeaderboard();
  });

  closeLeaderboardBtn.addEventListener('click', () => {
    leaderboardOverlay.classList.add('hidden');
  });

  clearLeaderboardBtn.addEventListener('click', () => {
    clearLeaderboardBtn.classList.add('hidden');
    clearPasscodeSection.classList.remove('hidden');
    clearPasscodeInput.value = '';
    clearError(clearPasscodeError);
    clearPasscodeInput.focus();
  });

  function resetClearPasscode(): void {
    clearPasscodeSection.classList.add('hidden');
    clearLeaderboardBtn.classList.remove('hidden');
    clearPasscodeInput.value = '';
    clearError(clearPasscodeError);
  }

  cancelClearBtn.addEventListener('click', resetClearPasscode);

  confirmClearBtn.addEventListener('click', () => {
    if (clearPasscodeInput.value.trim().toLowerCase() !== CLEAR_PASSCODE) {
      showError(clearPasscodeError, 'Incorrect passcode.');
      return;
    }
    clearError(leaderboardError);
    leaderboardStatus.classList.add('hidden');
    confirmClearBtn.disabled = true;
    void (async () => {
      try {
        await clearLeaderboard();
        renderLeaderboard(menuLeaderboardBody, []);
        renderScoreChart(scoreChart, []);
        resetClearPasscode();
        showStatus(leaderboardStatus, 'Leaderboard cleared.');
      } catch (err) {
        showError(leaderboardError, 'Could not clear the leaderboard. Please try again.');
        console.error(err);
      } finally {
        confirmClearBtn.disabled = false;
      }
    })();
  });

  raceProgressLabel.addEventListener('click', () => void showScoreDistribution());
  startDialogTitle.addEventListener('click', () => void showScoreDistribution());

  closeScoreDistributionBtn.addEventListener('click', () => {
    scoreDistributionOverlay.classList.add('hidden');
  });
}
