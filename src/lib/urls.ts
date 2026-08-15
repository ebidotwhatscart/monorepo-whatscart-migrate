const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
export const publicRootDomain = (
  process.env.NEXT_PUBLIC_ROOT_DOMAIN || "whatscart.in"
).replace(/^https?:\/\//, "").replace(/\/$/, "");
const configuredHostname = configuredAppUrl
  ? new URL(configuredAppUrl).hostname
  : null;
export const appHostname = configuredHostname &&
  ![publicRootDomain, `www.${publicRootDomain}`].includes(configuredHostname)
  ? configuredHostname
  : `app.${publicRootDomain}`;
export const adminHostname = `admin.${publicRootDomain}`;

const supportsTenantSubdomains = ["whatscart.in", "lvh.me"].includes(
  publicRootDomain,
);

const TENANT_HOST_PATTERN = new RegExp(
  `^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\\.${publicRootDomain.replaceAll(".", "\\.")}$`,
  "i",
);

/** Returns the business slug encoded by business-id.whatscart.in, if present. */
export function getTenantSlug(
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
) {
  const match = hostname.match(TENANT_HOST_PATTERN);
  if (!match || ["www", "admin", "app"].includes(match[1].toLowerCase())) {
    return null;
  }
  return match[1].toLowerCase();
}

/** Builds the canonical public URL for a tenant storefront. */
export function storefrontUrl(slug: string, path = "") {
  const normalizedPath = path ? `/${path.replace(/^\//, "")}` : "";
  const configuredOrigin = configuredAppUrl ||
    (typeof window !== "undefined" ? window.location.origin : `https://${publicRootDomain}`);

  if (supportsTenantSubdomains) {
    const origin = new URL(configuredOrigin);
    const usesConfiguredTenantOrigin = origin.hostname === publicRootDomain ||
      origin.hostname.endsWith(`.${publicRootDomain}`);
    if (configuredAppUrl && !usesConfiguredTenantOrigin) {
      return `${configuredOrigin.replace(/\/$/, "")}/store/${slug}${normalizedPath}`;
    }
    origin.hostname = `${slug}.${publicRootDomain}`;
    origin.pathname = normalizedPath || "/";
    origin.search = "";
    origin.hash = "";
    return origin.toString().replace(/\/$/, normalizedPath ? "" : "/");
  }

  return `${configuredOrigin.replace(/\/$/, "")}/store/${slug}${normalizedPath}`;
}

/** Builds an in-app path without leaving a tenant subdomain. */
export function storefrontPath(
  slug: string,
  path = "",
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
) {
  const normalizedPath = path ? `/${path.replace(/^\//, "")}` : "/";
  return getTenantSlug(hostname) === slug
    ? normalizedPath
    : `/store/${slug}${normalizedPath === "/" ? "" : normalizedPath}`;
}

export function productSlug(name: string, id: string, persistedSlug?: string) {
  if (persistedSlug) return persistedSlug;
  const readable = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "product";
  return `${readable}-${id.slice(-6).toLowerCase()}`;
}

export const publicAppUrl =
  configuredAppUrl ||
  (typeof window !== "undefined" && window.location.hostname === adminHostname
    ? `${window.location.protocol}//${publicRootDomain}`
    : typeof window !== "undefined"
      ? window.location.origin
      : "https://whatscart.in");

export function publicUrl(path: string) {
  return `${publicAppUrl}/${path.replace(/^\//, "")}`;
}
