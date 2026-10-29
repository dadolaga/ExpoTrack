import { ProfilePicker } from "@/components/profiles/ProfilePicker";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scegli profilo · ExpoTrack",
};

export default function ProfilesPage() {
  return <ProfilePicker />;
}
