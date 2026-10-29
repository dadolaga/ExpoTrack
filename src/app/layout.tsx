import { ThemeController } from "@/components/layout/ThemeController";
import { themeInitializationScript } from "@/lib/theme";

import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

type RootLayoutProps = {
  children: ReactNode;
};

export const metadata: Metadata = {
  title: "ExpoTrack",
  description: "Pianifica e documenta le tue visite a fiere ed eventi.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeInitializationScript,
          }}
        />
      </head>
      <body>
        <ThemeController />
        {children}
      </body>
    </html>
  );
}
