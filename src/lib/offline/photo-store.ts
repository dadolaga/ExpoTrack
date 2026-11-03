import { readRequest } from "./database";
import { createLocalId } from "./identity";
import { LocalInputError, isProductDeleted } from "./product-input";

import type { LocalContext, LocalProduct, OutboxOperation } from "../../types/offline";
import type { LocalPhoto, PhotoAsset, PhotoData } from "../../types/photos";

export function photoKey(context: LocalContext, id: string) {
  return [
    context.profileId, context.eventId, id,
  ];
}

export async function readProductPhotos(transaction: IDBTransaction, context: LocalContext, productId: string) {
  const records = await readRequest<LocalPhoto[]>(transaction.objectStore("photos")
    .index("by_product").getAll([
      context.profileId, context.eventId, productId,
    ]));

  return records.sort((first, second) => {
    const order = first.addedOrder - second.addedOrder;

    return order === 0 ? first.id.localeCompare(second.id) : order;
  });
}

export async function photoParent(transaction: IDBTransaction, context: LocalContext, productId: string) {
  const parent = await readRequest<LocalProduct | undefined>(transaction.objectStore("products")
    .get(photoKey(context, productId)));

  if (parent === undefined || isProductDeleted(parent)) {
    throw new LocalInputError("Il prodotto non è disponibile: impossibile modificare le foto.");
  }

  return parent;
}

export function storePhoto(transaction: IDBTransaction, photo: LocalPhoto, parent: LocalProduct) {
  const queued = parent.lastValid !== null;
  const operationId = queued ? createLocalId() : null;
  const record: LocalPhoto = {
    ...photo,
    localSequence: photo.localSequence + 1,
    latestOperationId: operationId,
    updatedAt: new Date().toISOString(),
  };

  transaction.objectStore("photos").put(record);
  if (queued && operationId !== null) {
    const {
      localSequence, serverRevision, latestOperationId: _latest, remoteMediaStatus: _mediaStatus, ...payload
    } = record;

    const mutation = photo.latestOperationId === null ? "create" : "update";

    transaction.objectStore("outbox").add({
      profileId: record.profileId,
      eventId: record.eventId,
      operationId,
      entityId: record.id,
      entityType: "photo",
      action: record.deletedAt !== null ? "delete" : mutation,
      localSequence,
      baseRevision: serverRevision,
      dependsOn: [photo.latestOperationId, parent.latestOperationId]
        .filter((id): id is string => id !== null),
      payload: payload satisfies PhotoData,
      status: "pending",
      queuedAt: record.updatedAt,
    } satisfies OutboxOperation);
  }

  return record;
}

export async function queueProductPhotos(transaction: IDBTransaction, parent: LocalProduct) {
  const photos = await readProductPhotos(transaction, parent, parent.id);

  for (const photo of photos) {
    if (photo.deletedAt === null && photo.latestOperationId === null) {
      storePhoto(transaction, photo, parent);
    }
  }
}

export async function removePhoto(transaction: IDBTransaction, photo: LocalPhoto, parent: LocalProduct) {
  if (photo.deletedAt !== null) {
    return;
  }
  // Never remove bytes while an operation can still reference or recover this photo.
  if (photo.latestOperationId === null && photo.serverRevision === null) {
    const operations = await readRequest<OutboxOperation[]>(transaction.objectStore("outbox").getAll());
    const referenced = operations.some((operation) => operation.entityType === "photo"
      && operation.profileId === photo.profileId && operation.eventId === photo.eventId
      && operation.payload.id === photo.id);

    if (!referenced) {
      transaction.objectStore("photos").delete(photoKey(photo, photo.id));
      transaction.objectStore("photo_assets").delete(photoKey(photo, photo.id));

      return;
    }
  }
  storePhoto(transaction, {
    ...photo,
    isPrimary: false,
    deletedAt: new Date().toISOString(),
  }, parent);
}

export async function removeProductPhotos(transaction: IDBTransaction, parent: LocalProduct) {
  const photos = await readProductPhotos(transaction, parent, parent.id);

  for (const photo of photos) {
    await removePhoto(transaction, photo, parent);
  }
  const updated = await readProductPhotos(transaction, parent, parent.id);

  return updated.map((photo) => photo.latestOperationId).filter((id): id is string => id !== null);
}

export async function collectPhotoOrphans(transaction: IDBTransaction) {
  const photos = await readRequest<LocalPhoto[]>(transaction.objectStore("photos").getAll());
  const operations = await readRequest<OutboxOperation[]>(transaction.objectStore("outbox").getAll());
  const assets = await readRequest<PhotoAsset[]>(transaction.objectStore("photo_assets").getAll());
  const references = new Set(photos.map((photo) => JSON.stringify(photoKey(photo, photo.id))));

  for (const operation of operations) {
    if (operation.entityType === "photo") {
      references.add(JSON.stringify(photoKey(operation.payload, operation.payload.id)));
    }
  }
  let removed = 0;

  for (const asset of assets) {
    if (!references.has(JSON.stringify(photoKey(asset, asset.id)))) {
      transaction.objectStore("photo_assets").delete(photoKey(asset, asset.id));
      removed += 1;
    }
  }

  return removed;
}
