import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cachedClient: {
  app: ReturnType<typeof initializeApp>;
  auth: ReturnType<typeof getAuth>;
  firestore: ReturnType<typeof getFirestore>;
  storage: ReturnType<typeof getStorage>;
} | null = null;

let emulatorsConnected = false;

export function getFirebaseClient() {
  if (cachedClient) return cachedClient;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const client = {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app),
  };

  if (
    process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true" &&
    !emulatorsConnected
  ) {
    const host = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || "127.0.0.1";
    connectAuthEmulator(client.auth, `http://${host}:9099`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(client.firestore, host, 8081);
    connectStorageEmulator(client.storage, host, 9199);
    emulatorsConnected = true;
  }

  cachedClient = client;
  return client;
}
