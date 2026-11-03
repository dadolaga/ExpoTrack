"use client";

import Image from "next/image";

import { useBlobUrl } from "@/features/photos/use-blob-url";

export function PhotoImage({
  blob, alt, width, height, className,
}: {
  blob: Blob | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  const url = useBlobUrl(blob);

  if (url === undefined) {
    return <span role="status">Caricamento immagine…</span>;
  }

  return (
    <Image
      src={url}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={className}
    />
  );
}
