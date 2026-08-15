"use client";

import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getFirebaseClient } from "./client";

type FirebaseAuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(null);

async function syncSession(user: User | null) {
  if (!user) {
    await fetch("/api/auth/session", { method: "DELETE" });
    return;
  }

  let idToken = await user.getIdToken();
  let response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) {
    throw new Error("Unable to establish the Firebase session.");
  }

  const bootstrapResponse = await fetch("/api/auth/bootstrap", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!bootstrapResponse.ok) {
    throw new Error("Unable to initialize the Firebase user.");
  }
  const bootstrap = (await bootstrapResponse.json()) as {
    refreshToken?: boolean;
  };
  if (bootstrap.refreshToken) {
    idToken = await user.getIdToken(true);
    response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) {
      throw new Error("Unable to refresh the Firebase session.");
    }
  }
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const client = getFirebaseClient();
    if (!client) {
      setIsLoaded(true);
      return;
    }

    return onIdTokenChanged(client.auth, (nextUser) => {
      setUser(nextUser);
      setIsLoaded(true);
      void syncSession(nextUser).catch((error) => {
        console.error("Firebase session synchronization failed", error);
      });
    });
  }, []);

  const signIn = useCallback(async () => {
    const client = getFirebaseClient();
    if (!client) throw new Error("Firebase client configuration is missing.");
    await signInWithPopup(client.auth, new GoogleAuthProvider());
  }, []);

  const signOut = useCallback(async () => {
    const client = getFirebaseClient();
    if (!client) return;
    await firebaseSignOut(client.auth);
    await syncSession(null);
  }, []);

  const value = useMemo<FirebaseAuthContextValue>(
    () => ({
      isLoaded,
      isSignedIn: Boolean(user),
      user,
      signIn,
      signOut,
    }),
    [isLoaded, signIn, signOut, user],
  );

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth() {
  const value = useContext(FirebaseAuthContext);
  if (!value) {
    throw new Error("useFirebaseAuth must be used within FirebaseAuthProvider.");
  }
  return value;
}
