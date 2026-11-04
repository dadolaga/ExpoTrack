"use client";

import NextLink from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter, useSearchParams as useNextSearchParams } from "next/navigation";
import {
  createContext, useContext, useEffect, useMemo, useState,
} from "react";

import type { ComponentProps, ReactNode } from "react";

const OfflineNavigation = createContext<{
  url: URL;
  router: ReturnType<typeof useNextRouter>;
} | null>(null);

// Only the cached shell uses History navigation: it already contains every screen
// and must not request Server Component payloads for new local IDs.
export function OfflineNavigationProvider({ children }: {
  children: ReactNode;
}) {
  const [url, setUrl] = useState<URL | null>(null);
  const nextRouter = useNextRouter();
  const router = useMemo(() => {
    function navigate(href: string, replace: boolean, options?: {
      scroll?: boolean;
    }) {
      const destination = new URL(href, window.location.href);

      if (destination.origin !== window.location.origin || !["http:", "https:"].includes(destination.protocol)) {
        return;
      }
      if (replace) {
        window.history.replaceState(null, "", destination);
      } else {
        window.history.pushState(null, "", destination);
      }
      setUrl(destination);
      if (options?.scroll !== false) {
        window.scrollTo(0, 0);
        const main = document.getElementById("main-content");

        if (main !== null) {
          main.scrollTop = 0;
          main.focus();
        }
      }
    }

    return {
      ...nextRouter,
      push: (href: string, options?: {
        scroll?: boolean;
      }) => {
        navigate(href, false, options);
      },
      replace: (href: string, options?: {
        scroll?: boolean;
      }) => {
        navigate(href, true, options);
      },
      back: () => {
        window.history.back();
      },
      forward: () => {
        window.history.forward();
      },
      refresh: () => {
        window.location.reload();
      },
      prefetch: () => Promise.resolve(),
    };
  }, [nextRouter]);

  useEffect(() => {
    function update() {
      setUrl((current) => current?.href === window.location.href ? current : new URL(window.location.href));
    }

    const previousPush = window.history.pushState.bind(window.history);
    const previousReplace = window.history.replaceState.bind(window.history);

    // Editors also use History directly to retain input IDs and list filters.
    window.history.pushState = (...args) => {
      previousPush(...args);
      update();
    };
    window.history.replaceState = (...args) => {
      previousReplace(...args);
      update();
    };

    update();
    window.addEventListener("popstate", update);

    return () => {
      window.removeEventListener("popstate", update);
      window.history.pushState = previousPush;
      window.history.replaceState = previousReplace;
    };
  }, []);

  if (url === null) {
    return <p role="status">Apertura della copia sul dispositivo…</p>;
  }

  return (
    <OfflineNavigation.Provider
      value={{
        url,
        router,
      }}
    >{children}
    </OfflineNavigation.Provider>
  );
}

export function useRouter() {
  const next = useNextRouter();

  return useContext(OfflineNavigation)?.router ?? next;
}

export function usePathname() {
  const next = useNextPathname();

  return useContext(OfflineNavigation)?.url.pathname ?? next;
}

export function useSearchParams() {
  const next = useNextSearchParams();

  return useContext(OfflineNavigation)?.url.searchParams ?? next;
}

export default function Link({
  href, onNavigate, onClick, replace, scroll, prefetch, ...props
}: ComponentProps<typeof NextLink>) {
  const offline = useContext(OfflineNavigation);

  if (offline === null || typeof href !== "string") {
    return (
      <NextLink
        {...props}
        href={href}
        onNavigate={onNavigate}
        onClick={onClick}
        replace={replace}
        scroll={scroll}
        prefetch={prefetch}
      />
    );
  }

  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        const destination = new URL(href, offline.url);

        if (event.defaultPrevented || event.button !== 0
          || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
          || props.target === "_blank" || props.download !== undefined
          || destination.origin !== offline.url.origin || href.startsWith("#")) {
          return;
        }
        event.preventDefault();
        const navigation = {
          cancelled: false,
        };

        onNavigate?.({
          preventDefault: () => {
            navigation.cancelled = true;
          },
        });
        if (!navigation.cancelled) {
          if (replace === true) {
            offline.router.replace(href, {
              scroll,
            });
          } else {
            offline.router.push(href, {
              scroll,
            });
          }
        }
      }}
    />
  );
}
