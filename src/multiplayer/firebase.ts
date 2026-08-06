import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export let db: Firestore;

// Anonymous Auth gives every browser session a stable uid with no login UI,
// which is what makes reasonably scoped Firestore security rules possible
// without building real accounts. Deferred into a microtask (instead of
// running at module-evaluation time) so a bad/missing config rejects this
// promise instead of throwing synchronously and crashing the whole module
// graph before the app gets a chance to show a friendly error.
export const whenReady: Promise<string> = Promise.resolve().then(() => {
  const app = initializeApp(firebaseConfig);
  // Firestore's default WebChannel streaming transport can hang behind
  // restrictive proxies/sandboxes even when plain HTTPS works fine -
  // auto-detecting long-polling avoids that without adding latency for
  // users on unrestricted networks.
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  const auth = getAuth(app);

  // Wait for onAuthStateChanged rather than just the signInAnonymously
  // promise - that's the signal Firestore's own client actually listens to
  // internally, so resolving too early here can race a write against
  // Firestore not yet having the fresh auth token attached.
  return new Promise<string>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsubscribe();
          resolve(user.uid);
        }
      },
      (err) => {
        unsubscribe();
        reject(err);
      },
    );
    signInAnonymously(auth).catch((err) => {
      unsubscribe();
      reject(err);
    });
  });
});
