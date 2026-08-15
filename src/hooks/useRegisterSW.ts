"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RegisterSWOptions = {
  onRegisteredSW?: (
    serviceWorkerUrl: string,
    registration?: ServiceWorkerRegistration,
  ) => void;
  onRegisterError?: (error: unknown) => void;
};

export function useRegisterSW(options: RegisterSWOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [needRefresh, setNeedRefresh] = useState(false);
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let active = true;
    let hasController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    const serviceWorkerUrl = "/sw.js";
    const handleControllerChange = () => {
      if (hasController && !reloading) {
        reloading = true;
        window.location.reload();
        return;
      }
      hasController = true;
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    let updateTimer: ReturnType<typeof setInterval> | undefined;
    let updateRegistration: (() => void) | undefined;
    void navigator.serviceWorker
      .register(serviceWorkerUrl, { updateViaCache: "none" })
      .then((nextRegistration) => {
        if (!active) return;
        setRegistration(nextRegistration);
        optionsRef.current.onRegisteredSW?.(serviceWorkerUrl, nextRegistration);

        if (nextRegistration.waiting) setNeedRefresh(true);
        nextRegistration.addEventListener("updatefound", () => {
          const installing = nextRegistration.installing;
          installing?.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              nextRegistration.waiting?.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });

        updateRegistration = () => {
          if (document.visibilityState === "visible") {
            void nextRegistration.update().catch((error: unknown) =>
              optionsRef.current.onRegisterError?.(error),
            );
          }
        };
        updateRegistration();
        updateTimer = setInterval(updateRegistration, 30_000);
        window.addEventListener("focus", updateRegistration);
        document.addEventListener("visibilitychange", updateRegistration);
      })
      .catch((error: unknown) => optionsRef.current.onRegisterError?.(error));

    return () => {
      active = false;
      if (updateTimer) clearInterval(updateTimer);
      if (updateRegistration) {
        window.removeEventListener("focus", updateRegistration);
        document.removeEventListener("visibilitychange", updateRegistration);
      }
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  const updateServiceWorker = useCallback(
    async (reloadPage = false) => {
      const waiting = registration?.waiting;
      if (!waiting) {
        await registration?.update();
        return;
      }
      if (reloadPage && !navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => window.location.reload(),
          { once: true },
        );
      }
      waiting.postMessage({ type: "SKIP_WAITING" });
      setNeedRefresh(false);
    },
    [registration],
  );

  return {
    needRefresh: [needRefresh, setNeedRefresh] as const,
    updateServiceWorker,
  };
}
