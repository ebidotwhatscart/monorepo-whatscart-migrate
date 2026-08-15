import { useCallback, useState } from "react";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { api, type Id } from "../lib/firebase/operations";

const SESSION_KEY = "wc_session";

function getOrCreateSession(): string {
  if (typeof window === "undefined") return "";
  
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) return stored;
  
  const newId = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, newId);
  return newId;
}

export function useAnalytics(businessId: string) {
  const [sessionId] = useState(() => getOrCreateSession());
  const trackPageView = useMutation(api.analytics.trackPageView);
  const trackProductView = useMutation(api.analytics.trackProductView);

  const trackPage = useCallback((pageUrl?: string) => {
    if (!businessId || !sessionId) return;
    
    const params = new URLSearchParams(window.location.search);
    trackPageView({
      businessId: businessId as Id<"businesses">,
      pageUrl: pageUrl || window.location.pathname,
      sessionId,
      referrer: document.referrer || "",
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
    });
  }, [businessId, sessionId, trackPageView]);

  const trackProduct = useCallback((productId: string) => {
    if (!businessId || !sessionId) return;
    
    const params = new URLSearchParams(window.location.search);
    trackProductView({
      businessId: businessId as Id<"businesses">,
      productId: productId as Id<"products">,
      sessionId,
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
    });
  }, [businessId, sessionId, trackProductView]);

  return { trackPage, trackProduct };
}

export function useSessionId() {
  return useState(() => getOrCreateSession())[0];
}
