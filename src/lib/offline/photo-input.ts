import { LocalInputError } from "./product-input";

import type { PreparedPhoto } from "../../types/photos";

export const MAX_PHOTO_BYTES = 64 * 1024 * 1024;
export const MAX_PHOTO_PIXELS = 100_000_000;

export function validatePhotoDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1
    || width > 20000 || height > 20000 || width * height > MAX_PHOTO_PIXELS) {
    throw new LocalInputError("Foto troppo grande: massimo 100 megapixel e 20.000 pixel per lato. Scegli una versione più piccola.");
  }
}

export function inspectPhoto(bytes: Uint8Array): {
  contentType: PreparedPhoto["contentType"];
  width: number;
  height: number;
} {
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    throw new LocalInputError("File vuoto o superiore a 64 MiB. Scegli un’altra foto.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  let contentType: PreparedPhoto["contentType"];
  let width = 0;
  let height = 0;

  if (bytes.length >= 24 && ascii(0, 8) === "\u0089PNG\r\n\u001a\n" && ascii(12, 16) === "IHDR") {
    contentType = "image/png";
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    contentType = "image/jpeg";
    let offset = 2;

    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        break;
      }
      const marker = bytes[offset + 1];

      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      if (marker === 0xd9 || marker === 0xda) {
        break;
      }
      const length = view.getUint16(offset + 2);

      if (length < 2 || offset + length + 2 > bytes.length) {
        break;
      }
      if ([
        0xc0, 0xc1, 0xc2,
      ].includes(marker)) {
        height = view.getUint16(offset + 5);
        width = view.getUint16(offset + 7);
        break;
      }
      offset += length + 2;
    }
  } else if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    contentType = "image/webp";
    const chunk = ascii(12, 16);

    if (chunk === "VP8X") {
      if ((bytes[20] & 2) !== 0) {
        throw new LocalInputError("WebP animato non supportato. Scegli una foto statica.");
      }
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (chunk === "VP8L" && bytes[20] === 0x2f) {
      width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8);
      height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10);
    } else if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) {
      width = view.getUint16(26, true) & 0x3fff;
      height = view.getUint16(28, true) & 0x3fff;
    }
  } else {
    throw new LocalInputError("Formato non supportato. Scegli JPEG, PNG o WebP; per HEIC/HEIF esporta prima una copia JPEG.");
  }
  validatePhotoDimensions(width, height);

  return {
    contentType,
    width,
    height,
  };
}

export function validatePreparedPhoto(photo: PreparedPhoto) {
  validatePhotoDimensions(photo.width, photo.height);
  if (!/^[a-f\d]{64}$/u.test(photo.sha256) || photo.filename.trim() === ""
    || photo.byteSize < 1 || photo.byteSize > MAX_PHOTO_BYTES
    || photo.original.size !== photo.byteSize || photo.thumbnail.size === 0 || photo.preview.size === 0
    || ![
      "image/jpeg", "image/png", "image/webp",
    ].includes(photo.contentType)) {
    throw new LocalInputError("Foto non valida: scegli nuovamente il file.");
  }
}
