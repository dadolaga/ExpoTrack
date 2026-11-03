"use client";

import { useEffect, useState } from "react";

import type { LocalRepository } from "@/lib/offline/repository";

export function useRemoteRevision(repository: LocalRepository) {
  const [revision, setRevision] = useState(0);

  useEffect(() => repository.subscribe((kind) => {
    if (kind === "remote") {
      setRevision((previous) => previous + 1);
    }
  }), [repository]);

  return revision;
}
