"use client";

import { useEffect, useState } from "react";

export function useBlobUrl(blob: Blob | undefined) {
  const [value, setValue] = useState<{
    blob: Blob;
    url: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    let url: string | undefined;

    // Publish the external resource only while its component is still mounted.
    void Promise.resolve().then(() => {
      if (active && blob !== undefined) {
        url = URL.createObjectURL(blob);
        setValue({
          blob,
          url,
        });
      }
    });

    return () => {
      active = false;
      if (url !== undefined) {
        URL.revokeObjectURL(url);
      }
    };
  }, [blob]);

  return value?.blob === blob ? value?.url : undefined;
}
