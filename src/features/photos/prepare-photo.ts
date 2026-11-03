import { hashPhoto } from "@/lib/offline/photo-hash";
import { inspectPhoto, MAX_PHOTO_BYTES, validatePhotoDimensions } from "@/lib/offline/photo-input";

import type { PreparedPhoto } from "@/types/photos";

type Decoded = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decode(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap !== "undefined") {
    try {
      const bitmap = await createImageBitmap(blob, {
        imageOrientation: "from-image",
      });

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => {
          bitmap.close();
        },
      };
    } catch { /* Some mobile browsers require the image-element decoder. */ }
  }
  const url = URL.createObjectURL(blob);
  const image = new Image();

  try {
    image.src = url;
    await image.decode();

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => {
        URL.revokeObjectURL(url);
      },
    };
  } catch {
    URL.revokeObjectURL(url);

    throw new Error("Immagine non leggibile. Prova un’altra foto o esportala come JPEG.");
  }
}

function derive(image: Decoded, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");

  if (context === null) {
    throw new Error("Anteprima non disponibile. Riprova con un’altra foto.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image.source, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;
      if (blob === null) {
        reject(new Error("Impossibile generare l’anteprima. Riprova."));
      } else {
        resolve(blob);
      }
    }, "image/jpeg", quality);
  });
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
    throw new Error("File vuoto o superiore a 64 MiB. Scegli un’altra foto.");
  }
  const buffer = await file.arrayBuffer();
  const { contentType } = inspectPhoto(new Uint8Array(buffer));
  const original = new Blob([buffer], {
    type: contentType,
  });
  const sha256 = await hashPhoto(buffer);
  const image = await decode(original);

  try {
    validatePhotoDimensions(image.width, image.height);
    const thumbnail = await derive(image, 480, 0.82);
    const preview = await derive(image, 2048, 0.9);

    return {
      filename: file.name === "" ? "Foto" : file.name,
      contentType,
      byteSize: file.size,
      sha256,
      width: image.width,
      height: image.height,
      original,
      thumbnail,
      preview,
    };
  } finally {
    image.close();
  }
}
