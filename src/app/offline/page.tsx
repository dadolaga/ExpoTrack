import { Suspense } from "react";

import { OfflineApplication } from "@/components/pwa/OfflineApplication";

export default function OfflinePage() {
  return <Suspense fallback={<p role="status">Apertura di ExpoTrack…</p>}><OfflineApplication /></Suspense>;
}
