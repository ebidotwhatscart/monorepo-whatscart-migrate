#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const [domain, ...flags] = process.argv.slice(2);
const deploy = flags.includes("--deploy");
const normalizedDomain = domain?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

if (!normalizedDomain || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalizedDomain)) {
  throw new Error("Usage: npm run deployment:domain -- <root-domain> [--deploy]");
}

function vercel(...args) {
  const result = spawnSync("npx", ["--yes", "vercel@59.1.3", ...args], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const environment = "production,preview";
vercel("env", "add", "NEXT_PUBLIC_ROOT_DOMAIN", environment, "--value", normalizedDomain, "--no-sensitive", "--force", "--yes");
vercel("env", "add", "NEXT_PUBLIC_APP_URL", environment, "--value", `https://app.${normalizedDomain}`, "--no-sensitive", "--force", "--yes");

if (deploy) vercel("deploy", "--prod", "--yes");
