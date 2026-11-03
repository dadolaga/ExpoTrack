import { ActiveProfile } from "@/components/profiles/ActiveProfile";
import { ProfileSettings } from "@/components/profiles/ProfileSettings";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profilo · ExpoTrack",
};

export default function ProfilePage() {
  return (
    <>
      <ActiveProfile />
      <ProfileSettings />
    </>
  );
}
