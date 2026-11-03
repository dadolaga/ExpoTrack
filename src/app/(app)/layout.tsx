import { AppShell } from "@/components/layout/AppShell";
import { ProfileProvider } from "@/components/profiles/ProfileProvider";

import type { ReactNode } from "react";

export default function AppLayout({ children }: {
  children: ReactNode;
}) {
  return (
    <ProfileProvider>
      <AppShell>{children}</AppShell>
    </ProfileProvider>
  );
}
