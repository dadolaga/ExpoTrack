"use client";

import {
  useCallback, useEffect, useRef, useState,
} from "react";

import { useLocalAutosave } from "@/features/use-local-autosave";
import { createLocalId } from "@/lib/offline/identity";

import { preparePhoto } from "./prepare-photo";

import type { LocalRepository } from "@/lib/offline/repository";
import type { LocalContext, ProductInput } from "@/types/offline";
import type { PhotoAsset, PhotoItem, PreparedPhoto } from "@/types/photos";

type PhotoAction = {
  type: "add";
  entries: {
    id: string;
    file: File;
  }[];
} | {
  type: "primary" | "delete";
  id: string;
};

export function useProductPhotos(
  repository: LocalRepository,
  context: LocalContext,
  productId: string,
  input: ProductInput,
  beforeWrite: () => Promise<boolean>,
  refreshProduct: () => Promise<void>,
) {
  const { profileId, eventId } = context;
  const [items, setItems] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [asset, setAsset] = useState<PhotoAsset | undefined>();
  const [assetError, setAssetError] = useState(false);
  const prepared = useRef(new Map<string, PreparedPhoto>());
  const selected = selectedId === null ? undefined : items.find((item) => item.id === selectedId) ?? items.at(0);
  const activePhotoId = selected?.id;

  useEffect(() => {
    let active = true;

    void repository.listProductPhotos({
      profileId,
      eventId,
    }, productId).then((photos) => {
      if (active) {
        setItems(photos);
        setLoading(false);
        setLoadError(false);
      }
    }).catch(() => {
      if (active) {
        setLoadError(true);
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [
    repository, profileId, eventId, productId, attempt,
  ]);

  useEffect(() => {
    let active = true;

    if (activePhotoId !== undefined) {
      void repository.getPhotoAsset({
        profileId,
        eventId,
      }, activePhotoId).then((result) => {
        if (active) {
          setAsset(result);
          setAssetError(result === undefined);
        }
      }).catch(() => {
        if (active) {
          setAssetError(true);
        }
      });
    }

    return () => {
      active = false;
    };
  }, [
    repository, profileId, eventId, activePhotoId, attempt,
  ]);

  const write = useCallback(async (action: PhotoAction | null) => {
    setError(null);
    if (action === null) {
      prepared.current.clear();

      return;
    }
    try {
      if (!await beforeWrite()) {
        throw new Error("Riprova il salvataggio del prodotto prima delle foto.");
      }
      const scope = {
        profileId,
        eventId,
      };

      if (action.type === "add") {
        for (const [index, entry] of action.entries.entries()) {
          setProgress(`Foto ${index + 1} di ${action.entries.length}: preparazione e salvataggio…`);
          const photo = prepared.current.get(entry.id) ?? await preparePhoto(entry.file);

          prepared.current.set(entry.id, photo);
          await repository.addProductPhoto(scope, productId, entry.id, photo, input);
          await refreshProduct();
          setItems(await repository.listProductPhotos(scope, productId));
        }
      } else {
        await repository.changeProductPhoto(scope, productId, action.id, action.type);
        setItems(await repository.listProductPhotos(scope, productId));
      }
      prepared.current.clear();
      setProgress("");
    } catch (cause) {
      let message = cause instanceof Error ? cause.message : "Foto non salvata: riprova.";

      if (cause instanceof DOMException && cause.name === "QuotaExceededError") {
        message = "Spazio sul dispositivo insufficiente. Le foto già salvate sono conservate: libera spazio e riprova.";
      }

      setError(message);
      setProgress("");

      throw cause;
    }
  }, [
    repository, profileId, eventId, productId, input, beforeWrite, refreshProduct,
  ]);
  const autosave = useLocalAutosave<PhotoAction | null>(null, write, "/products");

  return {
    items,
    loading,
    loadError,
    error,
    progress,
    selected,
    assetError,
    asset: asset?.id === activePhotoId ? asset : undefined,
    status: autosave.status,
    busy: autosave.status === "saving",
    retry: autosave.retry,
    reload: () => {
      setAttempt((value) => value + 1);
    },
    select: (id: string | null) => {
      setAssetError(false);
      setSelectedId(id);
    },
    add: (files: File[]) => {
      if (files.length > 0) {
        autosave.change({
          type: "add",
          entries: files.map((file) => ({
            id: createLocalId(),
            file,
          })),
        });
      }
    },
    changePhoto: (id: string, type: "primary" | "delete") => {
      autosave.change({
        type,
        id,
      });
    },
    dismissError: () => {
      autosave.change(null);
    },
  };
}
