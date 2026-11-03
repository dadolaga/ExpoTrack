import { Suspense } from "react";

import { ProfilePicker } from "@/components/profiles/ProfilePicker";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scegli profilo · ExpoTrack",
};

export default function ProfilesPage() {
  return <Suspense fallback={<p>Caricamento profili…</p>}><ProfilePicker /></Suspense>;
}
