import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

type RootLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  title: "ExpoTrack",
  description: "Pianifica e documenta le tue visite a fiere ed eventi.",
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
