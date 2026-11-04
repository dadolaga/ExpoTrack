import { ThemeController } from "@/components/layout/ThemeController";
import { PwaProvider } from "@/components/pwa/OfflineStatus";
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
  appleWebApp: {
    capable: true,
    title: "ExpoTrack",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0866e8",
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
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
