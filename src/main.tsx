import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { FirebaseAuthProvider } from "./lib/firebase/auth-context";
import { FirebaseQueryHydrationProvider } from "./lib/firebase/hooks";

type ClarityCommand = ((...args: unknown[]) => void) & { q?: unknown[][] };
const clarityWindow = window as Window & { clarity?: ClarityCommand };
clarityWindow.clarity ??= (...args: unknown[]) => {
  const command = clarityWindow.clarity;
  if (!command) return;
  command.q ??= [];
  command.q.push(args);
};
const clarityScript = document.createElement("script");
clarityScript.async = true;
clarityScript.src = `https://www.clarity.ms/tag/${
  process.env.NODE_ENV === "production" ? "xdj4az2q0d" : "wtmfck3w0n"
}`;
document.head.appendChild(clarityScript);

createRoot(document.getElementById("root")!).render(
  <FirebaseAuthProvider>
    <FirebaseQueryHydrationProvider>
      <App />
    </FirebaseQueryHydrationProvider>
  </FirebaseAuthProvider>,
);
