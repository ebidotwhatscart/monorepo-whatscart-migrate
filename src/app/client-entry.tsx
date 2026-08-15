"use client";

import dynamic from "next/dynamic";

const LegacyAppShell = dynamic(() => import("./legacy-app-shell"), {
  ssr: false,
});

export default function ClientEntry() {
  return <LegacyAppShell />;
}

