import { useRegisterSW } from "../hooks/useRegisterSW";
import { X, WifiOff } from "lucide-react";
import { useState, useEffect } from "react";

export function PWAReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      if (!r) return;

      const checkForUpdate = () => {
        if (navigator.onLine) void r.update();
      };
      checkForUpdate();
      window.setInterval(checkForUpdate, 60 * 1000);
    },
    onRegisterError(error: unknown) {
      console.error("SW registration error", error);
    },
  });

  const [showPrompt, setShowPrompt] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const close = () => {
    setShowPrompt(false);
    setNeedRefresh(false);
  };

  return (
    <>
      {/* Offline Status Bar */}
      {!isOnline && (
        <div className="fixed bottom-0 left-0 right-0 bg-orange-500 text-white p-3 flex items-center justify-center gap-2 z-50">
          <WifiOff className="w-5 h-5" />
          <span className="font-medium">
            You're offline. Some features may be limited.
          </span>
        </div>
      )}

      {/* Update Prompt */}
      {needRefresh && showPrompt && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-lg border-2 border-primary p-4 z-50">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-sm">
                New version available
              </h3>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => updateServiceWorker(true)}
                  className="px-4 py-2 bg-primary text-white text-sm rounded-lg"
                >
                  Update Now
                </button>
                <button
                  onClick={close}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg"
                >
                  Later
                </button>
              </div>
            </div>
            <button onClick={close}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
