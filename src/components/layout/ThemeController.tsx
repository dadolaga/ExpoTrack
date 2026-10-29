"use client";

import { useLayoutEffect } from "react";

import { restoreThemePreference, watchStoredTheme } from "@/lib/theme";

export function ThemeController() {
  useLayoutEffect(() => {
    // Reapply after the development Strict Mode remount, as advised by Next.js.
    restoreThemePreference();

    return watchStoredTheme();
  }, []);

  return null;
}
