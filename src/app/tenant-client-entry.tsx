"use client";

import type { InitialFirebaseQueries } from "../lib/firebase/hooks";
import LegacyAppShell from "./legacy-app-shell";

export default function TenantClientEntry({
  firebaseOnly,
  hostname,
  initialQueries,
  pathname,
}: {
  firebaseOnly: boolean;
  hostname: string;
  initialQueries: InitialFirebaseQueries;
  pathname: string;
}) {
  return (
    <LegacyAppShell
      firebaseOnly={firebaseOnly}
      initialHostname={hostname}
      initialPathname={pathname}
      initialQueries={initialQueries}
    />
  );
}
