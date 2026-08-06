// 'unfinished' covers a race that was started but never reached a finish or
// loss (e.g. the player closed the tab) - the leaderboard entry is created
// the moment a race starts and checkpointed periodically, so an abandoned
// run still leaves a record instead of vanishing entirely.
export type RaceOutcome = 'finished' | 'lost' | 'unfinished';

export interface RaceResult {
  outcome: RaceOutcome;
  stars: number;
  strikes: number;
  distanceFraction: number;
  timeMs: number | null;
}
