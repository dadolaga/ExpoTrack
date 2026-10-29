export type ThemePreference = "system" | "light" | "dark";

const storageKey = "expotrack.theme";
const changeEvent = "expotrack:theme-change";

// Only a constant storage key is interpolated; no user content enters this script.
export const themeInitializationScript = `(() => {
  try {
    const theme = localStorage.getItem(${JSON.stringify(storageKey)});
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
  } catch {
    // The CSS system preference remains available when storage is blocked.
  }
})();`;

function applyTheme(preference: ThemePreference) {
  if (preference === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = preference;
  }

  window.dispatchEvent(new Event(changeEvent));
}

export function getThemePreference(): ThemePreference {
  const theme = document.documentElement.dataset.theme;

  return theme === "light" || theme === "dark" ? theme : "system";
}

export function getServerThemePreference() {
  return null;
}

export function subscribeToTheme(listener: () => void) {
  window.addEventListener(changeEvent, listener);

  return () => {
    window.removeEventListener(changeEvent, listener);
  };
}

export function restoreThemePreference() {
  try {
    const theme = window.localStorage.getItem(storageKey);

    applyTheme(theme === "light" || theme === "dark" ? theme : "system");
  } catch {
    // Keep the current session preference if storage cannot be read.
  }
}

export function watchStoredTheme() {
  function handleStorage(event: StorageEvent) {
    if (event.key === storageKey || event.key === null) {
      restoreThemePreference();
    }
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}

export function saveThemePreference(preference: ThemePreference): boolean {
  applyTheme(preference);

  try {
    window.localStorage.setItem(storageKey, preference);

    return true;
  } catch {
    return false;
  }
}
