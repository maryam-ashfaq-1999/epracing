import { MAX_STARS } from '../game/constants';
import type { LeaderboardEntry } from '../multiplayer/leaderboard';

interface TierInfo {
  label: string;
  color: string;
}

// Cumulative tiers - each threshold is the minimum score to qualify, and an
// entry lands in the highest tier it clears. "Score" is stars/collectibles
// for a finished run (what the player actually collected), or how far they
// got (distanceFraction) for a run that never finished - so an abandoned or
// lost run can't outrank a completed one just by grabbing early stars.
const TIERS: TierInfo[] = [
  { label: 'Top 95%', color: '#8de35b' },
  { label: 'Top 70%', color: '#5cc8ff' },
  { label: 'Top 50%', color: '#ffd35c' },
  { label: 'Below 30% / Unfinished', color: '#ff8a8a' },
];

function entryScore(entry: LeaderboardEntry): number {
  if (entry.outcome !== 'finished') return entry.distanceFraction;
  return Math.min(1, entry.stars / MAX_STARS);
}

function classifyEntry(entry: LeaderboardEntry): number {
  const score = entryScore(entry);
  if (entry.outcome === 'finished' && entry.strikes === 0 && score >= 0.95) return 0;
  if (score >= 0.7) return 1;
  if (score >= 0.5) return 2;
  return 3;
}

export function renderScoreChart(container: HTMLElement, entries: LeaderboardEntry[]): void {
  container.replaceChildren();

  const total = entries.length;
  if (total === 0) {
    const empty = document.createElement('div');
    empty.className = 'score-chart-empty';
    empty.textContent = 'No races recorded yet.';
    container.appendChild(empty);
    return;
  }

  const counts = [0, 0, 0, 0];
  for (const entry of entries) counts[classifyEntry(entry)] += 1;

  TIERS.forEach((tier, i) => {
    const count = counts[i];
    const pct = Math.round((count / total) * 100);

    const row = document.createElement('div');
    row.className = 'score-bar-row';

    const label = document.createElement('div');
    label.className = 'score-bar-label';
    label.textContent = tier.label;

    const track = document.createElement('div');
    track.className = 'score-bar-track';
    const fill = document.createElement('div');
    fill.className = 'score-bar-fill';
    fill.style.width = `${pct}%`;
    fill.style.background = tier.color;
    track.appendChild(fill);

    const value = document.createElement('div');
    value.className = 'score-bar-value';
    value.textContent = `${count} ${count === 1 ? 'run' : 'runs'} (${pct}%)`;

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    container.appendChild(row);
  });
}
