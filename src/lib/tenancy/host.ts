const RESERVED_SUBDOMAINS = new Set(["admin", "app", "www"]);

export function normalizeHostname(value: string | null) {
  return (value ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export function tenantFromHostname(hostname: string, rootDomain: string) {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedRoot = normalizeHostname(rootDomain);
  if (!normalizedHost.endsWith(`.${normalizedRoot}`)) return null;
  const tenant = normalizedHost.slice(0, -(normalizedRoot.length + 1));
  if (!tenant || tenant.includes(".") || RESERVED_SUBDOMAINS.has(tenant)) return null;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(tenant) ? tenant : null;
}

export function tenantOrigin(tenant: string, rootDomain: string) {
  return `https://${tenant}.${normalizeHostname(rootDomain)}`;
}

