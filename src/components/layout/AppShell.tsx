import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link rounded-input bg-primary p-3 font-medium text-on-primary"
      >
        Vai al contenuto
      </a>
      <TopBar />
      <main
        id="main-content"
        tabIndex={-1}
        className="app-main"
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-section p-page">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
