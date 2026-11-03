import type { LocalContext } from "./offline";

export type PhotoData = LocalContext & {
  id: string;
  productId: string;
  filename: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  sha256: string;
  width: number;
  height: number;
  isPrimary: boolean;
  addedOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type LocalPhoto = PhotoData & {
  localSequence: number;
  serverRevision: number | null;
  latestOperationId: string | null;
};

export type PreparedPhoto = Pick<PhotoData, "filename" | "contentType" | "byteSize" | "sha256" | "width" | "height"> & {
  original: Blob;
  preview: Blob;
  thumbnail: Blob;
};

export type PhotoAsset = LocalContext & PreparedPhoto & {
  id: string;
  productId: string;
};

export type PhotoItem = LocalPhoto & {
  thumbnail: Blob;
};
