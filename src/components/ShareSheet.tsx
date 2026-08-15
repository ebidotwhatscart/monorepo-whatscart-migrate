import { useCallback } from "react";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { api } from "../lib/firebase/operations";
import { useSessionId } from "../hooks/useAnalytics";
import { MessageCircle, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  /** Full share text — used for WhatsApp */
  shareText?: string;
  /** Called when "More" is clicked (native share sheet) */
  onNativeShare?: () => Promise<void>;
  /** Sent as `channel` in productShares mutation */
  productId?: string;
  businessId?: string;
}

type Platform = {
  id: string;
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
};

/* ── Custom SVG icons matching StorefrontFooter style ── */

function WhatsAppIcon({ color }: { color: string }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 2.134.631 4.118 1.712 5.78L2 22l4.293-1.66A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm4.417 13.085c-.183.514-.907.943-1.484.998-.508.048-1.035.053-1.672-.103-1.102-.27-2.088-.968-2.968-1.718-.806-.686-1.503-1.491-2.065-2.368-.301-.47-.6-.957-.836-1.48-.244-.54-.397-1.091-.447-1.657-.06-.678.177-1.135.468-1.455.273-.3.604-.39.806-.39h.56c.117 0 .303.013.483.323.274.474.56.946.832 1.426.127.224.197.39.272.518.033.057.054.093.073.12.16.238.124.502-.037.697l-.018.018c-.303.35-.398.474-.554.686a.742.742 0 00.12.977c.417.462.903.88 1.433 1.234.37.247.723.482 1.117.65.378.16.712.12.985-.13.276-.255.518-.507.753-.771.16-.18.344-.217.55-.107l2.165 1.07c.206.102.334.152.42.244.156.168.187.43.048.706z"
        fill={color}
      />
    </svg>
  );
}

function InstagramIcon({ color }: { color: string }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
        fill={color}
      />
    </svg>
  );
}

function FacebookIcon({ color }: { color: string }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
        fill={color}
      />
    </svg>
  );
}

function XIcon({ color }: { color: string }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
        fill={color}
      />
    </svg>
  );
}

/* ── Platforms config ── */

const platforms: Platform[] = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    color: "#25D366",
    bg: "bg-green-50",
    icon: <WhatsAppIcon color="#25D366" />,
  },
  {
    id: "instagram",
    label: "Instagram",
    color: "#E4405F",
    bg: "bg-pink-50",
    icon: <InstagramIcon color="#E4405F" />,
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    bg: "bg-blue-50",
    icon: <FacebookIcon color="#1877F2" />,
  },
  {
    id: "x",
    label: "X",
    color: "#000000",
    bg: "bg-gray-100",
    icon: <XIcon color="#000000" />,
  },
];

/* ── Helpers ── */

function openWindow(url: string) {
  window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
}

function withUtm(baseUrl: string, source: string): string {
  const u = new URL(baseUrl);
  u.searchParams.set("utm_source", source);
  u.searchParams.set("utm_medium", "share");
  return u.toString();
}

/* ── Component ── */

export default function ShareSheet({
  isOpen,
  onClose,
  url,
  title = "",
  shareText,
  onNativeShare,
  productId,
  businessId,
}: ShareSheetProps) {
  const sessionId = useSessionId();
  const trackProductShare = useMutation(api.analytics.trackProductShare);

  const trackShare = useCallback(
    async (channel: string) => {
      if (businessId && productId && sessionId) {
        try {
          await trackProductShare({ businessId, productId, sessionId, channel });
        } catch {
          // non-critical
        }
      }
    },
    [businessId, productId, sessionId, trackProductShare],
  );

  const handlePlatformShare = async (platformId: string) => {
    const shareUrl = withUtm(url, platformId);
    const encodedShareUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(
      shareText || [title, shareUrl].filter(Boolean).join("\n\n"),
    );

    switch (platformId) {
      case "whatsapp":
        openWindow(`https://wa.me/?text=${encodedText}`);
        break;
      case "instagram":
        // Instagram has no URL-sharing API; copy link and open app
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast.success("Link copied! Open Instagram to share.");
          window.open("https://instagram.com", "_blank", "noopener,noreferrer");
        } catch {
          toast.error("Failed to copy link");
        }
        break;
      case "facebook":
        openWindow(
          `https://facebook.com/sharer/sharer.php?u=${encodedShareUrl}&quote=${encodeURIComponent(title || "")}`,
        );
        break;
      case "x":
        openWindow(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(title || "")}&url=${encodedShareUrl}`,
        );
        break;
      case "copy": {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast.success("Link copied!");
        } catch {
          toast.error("Failed to copy link");
        }
        break;
      }
      case "more":
        if (onNativeShare) {
          await onNativeShare();
        } else if (navigator.share) {
          try {
            await navigator.share({
              title,
              text: shareText || title,
              url: shareUrl,
            });
          } catch {
            // user cancelled
          }
        } else {
          try {
            await navigator.clipboard.writeText(shareUrl);
            toast.success("Link copied!");
          } catch {
            toast.error("Failed to copy link");
          }
        }
        break;
    }

    await trackShare(platformId);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 pt-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[428px] rounded-t-[32px] bg-white px-4 pb-8 pt-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-gray-300" />

        <h2 className="mb-5 text-center text-lg font-semibold text-gray-900">
          Share via
        </h2>

        {/* Platform grid */}
        <div className="mx-auto grid max-w-xs grid-cols-4 gap-4">
          {platforms.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePlatformShare(p.id)}
              className={`flex flex-col items-center gap-2 rounded-xl p-3 transition-colors hover:opacity-80 ${p.bg}`}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
              >
                {p.icon}
              </div>
              <span className="text-[11px] font-medium text-gray-600">
                {p.label}
              </span>
            </button>
          ))}
        </div>

        {/* More actions */}
        <div className="mx-auto mt-5 flex max-w-xs gap-3">
          <button
            onClick={() => handlePlatformShare("copy")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Link2 className="h-4 w-4" />
            Copy Link
          </button>
          <button
            onClick={() => handlePlatformShare("more")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Share2 className="h-4 w-4" />
            More
          </button>
        </div>
      </div>
    </div>
  );
}
