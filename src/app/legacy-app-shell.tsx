"use client";

import App from "../App";
import { RuntimeLocationProvider } from "../context/RuntimeLocationContext";
import { FirebaseAuthProvider } from "../lib/firebase/auth-context";
import {
  FirebaseQueryHydrationProvider,
  type InitialFirebaseQueries,
} from "../lib/firebase/hooks";

export default function LegacyAppShell({
  firebaseOnly: _firebaseOnly = false,
  initialHostname,
  initialPathname,
  initialQueries,
}: {
  firebaseOnly?: boolean;
  initialHostname?: string;
  initialPathname?: string;
  initialQueries?: InitialFirebaseQueries;
}) {
  return (
    <FirebaseAuthProvider>
      <FirebaseQueryHydrationProvider initialQueries={initialQueries}>
        <RuntimeLocationProvider initialHostname={initialHostname}>
          <App
            initialHostname={initialHostname}
            initialPathname={initialPathname}
          />
        </RuntimeLocationProvider>
      </FirebaseQueryHydrationProvider>
    </FirebaseAuthProvider>
  );
}
