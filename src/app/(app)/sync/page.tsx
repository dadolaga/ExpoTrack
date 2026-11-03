import { SyncPage } from "@/components/sync/SyncPage";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sincronizzazione · ExpoTrack",
};

export default function SynchronizationPage() {
  return <SyncPage />;
}
