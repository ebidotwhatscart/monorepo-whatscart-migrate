import { serviceWorkerSource } from "../../lib/pwa/service-worker";

export const dynamic = "force-dynamic";

export function GET() {
  const deploymentVersion =
    process.env.VERCEL_URL ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_APP_VERSION ??
    "local-development";
  return new Response(serviceWorkerSource(deploymentVersion), {
    headers: {
      "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
      "cdn-cache-control": "no-store",
      "content-type": "application/javascript; charset=utf-8",
      "service-worker-allowed": "/",
      "vercel-cdn-cache-control": "no-store",
    },
  });
}
