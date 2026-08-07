import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { RaceResult } from './types';

const DELETE_BATCH_SIZE = 500; // Firestore's per-batch write limit

export interface LeaderboardEntry {
  name: string;
  outcome: RaceResult['outcome'];
  stars: number;
  strikes: number;
  distanceFraction: number;
  // Set once at creation (see createRaceEntry/submitScore) and never
  // touched by later checkpoint/finalize updates, so it reflects when the
  // run started - null only for the brief window before the server has
  // resolved the serverTimestamp() sentinel.
  createdAt: Date | null;
}

const LEADERBOARD_LIMIT = 100;

export async function submitScore(name: string, result: RaceResult): Promise<void> {
  await addDoc(collection(db, 'leaderboard'), {
    name,
    outcome: result.outcome,
    stars: result.stars,
    strikes: result.strikes,
    distanceFraction: result.distanceFraction,
    timeMs: result.timeMs,
    createdAt: serverTimestamp(),
  });
}

// Created the moment a race starts, with a placeholder 'unfinished' outcome,
// so an abandoned run (tab closed, never reaches a finish or loss) still
// leaves a record instead of never being written at all. Checkpointed via
// updateRaceEntry as the race progresses, then finalized at the end.
export async function createRaceEntry(name: string): Promise<string> {
  const ref = await addDoc(collection(db, 'leaderboard'), {
    name,
    outcome: 'unfinished',
    stars: 0,
    strikes: 0,
    distanceFraction: 0,
    timeMs: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateRaceEntry(entryId: string, result: RaceResult): Promise<void> {
  await updateDoc(doc(db, 'leaderboard', entryId), {
    outcome: result.outcome,
    stars: result.stars,
    strikes: result.strikes,
    distanceFraction: result.distanceFraction,
    timeMs: result.timeMs,
  });
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const leaderboardQuery = query(collection(db, 'leaderboard'), orderBy('createdAt', 'desc'), limit(LEADERBOARD_LIMIT));
  const snap = await getDocs(leaderboardQuery);
  return snap.docs.map((d) => {
    const data = d.data();
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null;
    return { ...data, createdAt } as LeaderboardEntry;
  });
}

export async function clearLeaderboard(): Promise<void> {
  const snap = await getDocs(collection(db, 'leaderboard'));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += DELETE_BATCH_SIZE) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + DELETE_BATCH_SIZE)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}
