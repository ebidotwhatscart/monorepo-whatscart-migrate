import { Link } from "react-router-dom";
import { Download, FileText, Globe, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import type { StorefrontTheme } from "../lib/storefrontTheme";
import whatscartPoweredLogoUrl from "../assets/figma/whatscart-powered-logo.svg";
import { storefrontPath } from "../lib/urls";
import { useRuntimeHostname } from "../context/RuntimeLocationContext";

type PublicCategory = {
  _id: string;
  name: string;
};

function phoneLabel(phone: string) {
  if (!phone) return "";
  if (phone.startsWith("91") && phone.length === 12) {
    return `(+91) ${phone.slice(2, 7)} ${phone.slice(7)}`;
  }
  return phone;
}

function formatAddress(
  address:
    | {
        buildingNo?: string;
        street?: string;
        town?: string;
        district?: string;
        pincode?: string;
        state?: string;
        country?: string;
      }
    | null
    | undefined,
): string {
  if (!address) return "";
  const parts = [
    address.buildingNo,
    address.street,
    address.town || address.district,
    address.state,
    address.pincode,
  ].filter(Boolean);
  return parts.join(", ");
}

export function StorefrontFooter({
  business,
  categories,
  selectedCategory,
  onSelectCategory,
  storefrontTheme,
}: {
  business: {
    name: string;
    slug: string;
    logoUrl?: string | null;
    whatsappPhone: string;
    description?: string;
    address?: {
      buildingNo?: string;
      street?: string;
      town?: string;
      district?: string;
      pincode?: string;
      state?: string;
      country?: string;
    } | null;
    serviceRegion?: string | null;
    socialLinks?: {
      instagram?: string;
      facebook?: string;
      x?: string;
    };
    fssaiNumber?: string | null;
    fssaiDocUrl?: string | null;
  };
  categories?: PublicCategory[];
  selectedCategory?: string;
  onSelectCategory?: (categoryId: string) => void;
  storefrontTheme: StorefrontTheme;
}) {
  const runtimeHostname = useRuntimeHostname();
  const description =
    business.description ||
    "Premium everyday products made simple. Shop curated essentials directly from this store.";
  const year = new Date().getFullYear();
  const categoryLinks = (categories ?? []).slice(0, 3);

  return (
    <footer
      className="mt-8"
      style={{
        backgroundColor: storefrontTheme.footerBackground,
        color: storefrontTheme.footerText,
      }}
    >
      <div className="mx-auto flex max-w-[1184px] flex-col gap-16 px-6 py-10 lg:flex-row lg:gap-24 lg:px-12 lg:py-20">
        <div className="flex flex-col gap-8 lg:min-w-[420px]">
          <div className="flex flex-col gap-6">
            <div className="flex items-center">
              {business.logoUrl ? (
                <img
                  src={business.logoUrl}
                  alt={business.name}
                  className="h-auto w-[16rem] object-cover"
                  loading="lazy"
                />
              ) : (
                <h2 className="text-[32px] font-black leading-tight tracking-[0.02em]">
                  {business.name}
                </h2>
              )}
            </div>

            <p className="max-w-[332px] text-base font-medium leading-[1.4]"
               style={{ color: storefrontTheme.footerText }}>
              {description}
            </p>

            <PoweredByWhatsCartPill />
          </div>

          <address className="space-y-4 not-italic"
                    style={{ color: storefrontTheme.footerText }}>
            {business.address ? (
              <FooterContactRow
                icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
              >
                {formatAddress(business.address)}
              </FooterContactRow>
            ) : (
              <FooterContactRow
                icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
              >
                Storefront available online across India.
              </FooterContactRow>
            )}
            {business.serviceRegion && (
              <FooterContactRow
                icon={<Globe className="h-4 w-4" aria-hidden="true" />}
              >
                Serving: {business.serviceRegion}
              </FooterContactRow>
            )}
            {business.fssaiNumber && (
              <FooterContactRow
                icon={<FileText className="h-4 w-4 text-amber-500" aria-hidden="true" />}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded border border-amber-500/30">
                    FSSAI Lic: {business.fssaiNumber}
                  </span>
                  {business.fssaiDocUrl && (
                    <a
                      href={business.fssaiDocUrl}
                      target="_blank"
                      rel="noreferrer"
                      download="FSSAI_Certificate.pdf"
                      aria-label="Download FSSAI Certificate PDF"
                      className="inline-flex items-center gap-1 text-xs underline hover:text-amber-500 font-medium"
                    >
                      <Download className="h-3 w-3" /> Download Certificate
                    </a>
                  )}
                </div>
              </FooterContactRow>
            )}
            <FooterContactRow
              icon={<Phone className="h-4 w-4" aria-hidden="true" />}
            >
              <a
                href={`https://wa.me/${business.whatsappPhone}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Contact on WhatsApp"
                className="transition"
              >
                {phoneLabel(business.whatsappPhone)}
              </a>
            </FooterContactRow>
            <FooterContactRow
              icon={<Mail className="h-4 w-4" aria-hidden="true" />}
            >
              <span>Contact through WhatsApp for orders.</span>
            </FooterContactRow>
          </address>
        </div>

        <div className="flex flex-col gap-8 lg:gap-12">
          {categoryLinks.length > 0 && (
            <nav
              className="flex flex-col items-start gap-4"
              aria-label="Footer categories"
            >
              {onSelectCategory
                ? categoryLinks.map((category) => (
                    <button
                      key={category._id}
                      type="button"
                      onClick={() => onSelectCategory(category._id)}
                      className="text-left text-base leading-[26px] transition"
                      aria-current={
                        selectedCategory === category._id ? "true" : undefined
                      }
                    >
                      {category.name}
                    </button>
                  ))
                : categoryLinks.map((category) => (
                    <Link
                      key={category._id}
                      to={storefrontPath(business.slug, "", runtimeHostname)}
                      className="text-base leading-[26px] transition"
                    >
                      {category.name}
                    </Link>
                  ))}
              <Link
                to={storefrontPath(business.slug, "", runtimeHostname)}
                className="text-base leading-[26px] transition"
              >
                Contact
              </Link>
            </nav>
          )}

          <div className="flex flex-col gap-6">
            <div
              className="flex flex-wrap items-center gap-3 text-sm leading-[22px]"
              style={{ color: storefrontTheme.footerMutedText }}
            >
              <span>{`\u00A9 ${year} ${business.name}.inc.`}</span>
              <span aria-hidden="true">&bull;</span>
              <span>Privacy</span>
              <span aria-hidden="true">&bull;</span>
              <span>Terms</span>
            </div>

            <FooterSocialIcons
              socialLinks={business.socialLinks}
              storefrontTheme={storefrontTheme}
            />
          </div>
        </div>
      </div>
    </footer>
  );
}

function PoweredByWhatsCartPill() {
  return (
    <a href="https://whatscart.in/" aria-label="Powered by WhatsCart" className="relative block h-14 w-[253px] overflow-hidden rounded-[10px] bg-black">
      <div className="absolute -left-1 -top-8 h-32 w-32 rounded-full bg-[#033500] blur-[31px]" />
      <div className="relative flex h-full items-center gap-3 px-5 text-base font-medium text-[#FAFAFA]">
        <span>Powered by</span>
        <span className="flex items-center gap-2">
          <img
            src={whatscartPoweredLogoUrl}
            alt="Whatscart logo"
            className="h-7 w-[22px]"
          />
          Whatscart
        </span>
      </div>
    </a>
  );
}

function FooterContactRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 text-base leading-[26px]">
      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <div>{children}</div>
    </div>
  );
}

function FooterSocialIcons({
  socialLinks,
  storefrontTheme,
}: {
  socialLinks?: {
    facebook?: string;
    x?: string;
    linkedin?: string;
    youtube?: string;
  };
  storefrontTheme: StorefrontTheme;
}) {
  const {
    facebook = "",
    x = "",
    linkedin = "",
    youtube = "",
  } = socialLinks ?? {};

  return (
    <div
      className="flex w-[171px] items-center justify-between"
      style={{ color: storefrontTheme.footerText }}
    >
      {x.length > 0 && (
        <FooterSocialLink
          href={x}
          label="X"
          storefrontTheme={storefrontTheme}
        >
          <FigmaXIcon />
        </FooterSocialLink>
      )}
      {facebook.length > 0 && (
        <FooterSocialLink
          href={facebook}
          label="Facebook"
          storefrontTheme={storefrontTheme}
        >
          <FigmaFacebookIcon />
        </FooterSocialLink>
      )}
      {linkedin.length > 0 && (
        <FooterSocialLink
          href={linkedin}
          label="LinkedIn"
          storefrontTheme={storefrontTheme}
        >
          <FigmaLinkedInIcon />
        </FooterSocialLink>
      )}
      {youtube.length > 0 && (
        <FooterSocialLink
          href={youtube}
          label="YouTube"
          storefrontTheme={storefrontTheme}
        >
          <FigmaYouTubeIcon />
        </FooterSocialLink>
      )}
    </div>
  );
}

function FooterSocialLink({
  href,
  label,
  children,
  storefrontTheme,
}: {
  href?: string;
  label: string;
  children: React.ReactNode;
  storefrontTheme: StorefrontTheme;
}) {
  if (!href) {
    return (
      <span
        className="flex h-[26px] w-[26px] items-center justify-center"
        aria-label={label}
        style={{ color: storefrontTheme.footerMutedText }}
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="flex h-[26px] w-[26px] items-center justify-center transition"
      style={{ color: storefrontTheme.footerText }}
    >
      {children}
    </a>
  );
}

function FigmaXIcon() {
  return (
    <svg
      className="h-[26px] w-[26px]"
      viewBox="0 0 26.0847 26.0847"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14.9744 11.4967L22.5283 2.89795H20.7396L14.1775 10.3629L8.93979 2.89795H2.89844L10.8198 14.1872L2.89844 23.203H4.6883L11.6133 15.3188L17.1452 23.203H23.1866M5.33414 4.21893H8.08318L20.7373 21.9463H17.9883"
        fill="currentColor"
      />
    </svg>
  );
}

function FigmaFacebookIcon() {
  return (
    <svg
      className="h-[26px] w-[26px]"
      viewBox="48.3047 0 26.0847 26.0847"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M73.9815 13.042C73.9815 6.06232 68.3264 0.407227 61.3467 0.407227C54.367 0.407227 48.7119 6.06232 48.7119 13.042C48.7119 19.3482 53.3323 24.5754 59.3725 25.524L59.3725 16.6944H56.1629V13.042H59.3725V10.2583C59.3725 7.09195 61.2576 5.34295 64.1447 5.34295C65.5274 5.34295 66.9733 5.58953 66.9733 5.58953V8.69728L65.3797 8.69728C63.8105 8.69728 63.3209 9.67139 63.3209 10.6705V13.042H66.825L66.2646 16.6944H63.3209L63.3209 25.524C69.3611 24.5754 73.9815 19.3482 73.9815 13.042Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FigmaLinkedInIcon() {
  return (
    <svg
      className="h-[26px] w-[26px]"
      viewBox="98.2402 1.62988 22.8238 22.8241"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M119.434 1.62988L99.8654 1.62988C98.9688 1.62988 98.2402 2.36861 98.2402 3.27546V22.8085C98.2402 23.7153 98.9688 24.454 99.8654 24.454L119.434 24.454C120.331 24.454 121.064 23.7153 121.064 22.8085V3.27546C121.064 2.36861 120.331 1.62988 119.434 1.62988ZM105.138 21.1934H101.756V10.301L105.144 10.301V21.1934H105.138ZM103.447 8.81338C102.362 8.81338 101.486 7.932 101.486 6.85193C101.486 5.77185 102.362 4.89048 103.447 4.89048C104.527 4.89048 105.408 5.77185 105.408 6.85193C105.408 7.93709 104.532 8.81338 103.447 8.81338ZM117.819 21.1934H114.436V15.895C114.436 14.6315 114.411 13.0063 112.679 13.0063C110.916 13.0063 110.646 14.3819 110.646 15.8033V21.1934H107.263V10.301L110.508 10.301V11.7887H110.554C111.007 10.9328 112.113 10.031 113.759 10.031C117.182 10.031 117.819 12.2879 117.819 15.2225V21.1934Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FigmaYouTubeIcon() {
  return (
    <svg
      className="h-[26px] w-[26px]"
      viewBox="144.915 0 26.0847 26.0847"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M169.806 7.06809C169.522 5.99707 168.684 5.15358 167.62 4.86732C165.691 4.34717 157.957 4.34717 157.957 4.34717C157.957 4.34717 150.223 4.34717 148.294 4.86732C147.23 5.15362 146.392 5.99707 146.108 7.06809C145.591 9.00936 145.591 13.0597 145.591 13.0597C145.591 13.0597 145.591 17.1099 146.108 19.0512C146.392 20.1222 147.23 20.9306 148.294 21.2168C150.223 21.737 157.957 21.737 157.957 21.737C157.957 21.737 165.691 21.737 167.62 21.2168C168.684 20.9306 169.522 20.1222 169.806 19.0512C170.323 17.1099 170.323 13.0597 170.323 13.0597C170.323 13.0597 170.323 9.00936 169.806 7.06809ZM155.427 16.737V9.38229L161.892 13.0597L155.427 16.737Z"
        fill="currentColor"
      />
    </svg>
  );
}
