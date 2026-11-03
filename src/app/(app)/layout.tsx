import { AppShell } from "@/components/layout/AppShell";
import { ProfileProvider } from "@/components/profiles/ProfileProvider";
import { SyncProvider } from "@/components/sync/SyncProvider";

import type { ReactNode } from "react";

export default function AppLayout({ children }: {
  children: ReactNode;
}) {
  return (
    <ProfileProvider>
      <SyncProvider><AppShell>{children}</AppShell></SyncProvider>
    </ProfileProvider>
  );
}
