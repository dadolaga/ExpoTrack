import { ThemeSelector } from "@/components/forms/ThemeSelector";
import { ActiveProfile } from "@/components/profiles/ActiveProfile";
import { Card } from "@/components/ui/Card";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profilo · ExpoTrack",
};

export default function ProfilePage() {
  return (
    <>
      <ActiveProfile />
      <section aria-labelledby="appearance-title">
        <Card>
          <h2 id="appearance-title">Aspetto</h2>
          <ThemeSelector />
        </Card>
      </section>
    </>
  );
}
