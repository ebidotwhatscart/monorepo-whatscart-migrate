import whatscartPoweredLogoUrl from "../assets/figma/whatscart-powered-logo.svg";
import { staticAssetUrl } from "../lib/staticAsset";

export function PoweredByWhatsCartPill() {
  return (
    <a
      href="https://whatscart.in/"
      aria-label="Powered by WhatsCart"
      className="relative block h-14 w-[253px] overflow-hidden rounded-[10px] bg-black"
    >
      <div className="absolute -left-1 -top-8 h-32 w-32 rounded-full bg-[#033500] blur-[31px]" />
      <div className="relative flex h-full items-center gap-3 px-5 text-base font-medium text-[#FAFAFA]">
        <span>Powered by</span>
        <span className="flex items-center gap-2">
          <img
            src={staticAssetUrl(whatscartPoweredLogoUrl)}
            alt="Whatscart logo"
            className="h-7 w-[22px]"
          />
          Whatscart
        </span>
      </div>
    </a>
  );
}