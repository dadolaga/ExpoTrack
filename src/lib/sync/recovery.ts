import { answerLabel } from "../offline/questionnaire-input";
import { productInput } from "../offline/sync-store";

import type { StandReference } from "../../types/catalog";
import type { LocalContext, ProductInput } from "../../types/offline";
import type { SyncRecovery } from "../../types/sync";
import type { LocalRepository } from "../offline/repository";

async function recoverProfile(repository: LocalRepository, profileId: string) {
  const catalog = await repository.getCatalog();
  const profile = catalog?.profiles.find((entry) => entry.id === profileId);

  if (profile?.enabled === true) {
    return profileId;
  }
  const id = await repository.sync.mappedId(`recover-profile:${profileId}`, "usr-");

  await repository.savePersonalProfile(id, {
    name: `${profile?.name ?? "Profilo"} recuperato`,
    color: profile?.color ?? "#0866E8",
  });

  return id;
}

async function recoverStand(
  repository: LocalRepository,
  originalScope: LocalContext,
  scope: LocalContext,
  ref: StandReference,
  recovery: SyncRecovery,
  forceNew = false,
): Promise<StandReference> {
  const catalog = await repository.getCatalog();
  const configured = catalog?.stands.find((entry) => entry.eventId === scope.eventId && entry.id === ref.standId);
  const personal = ref.source === "personal" ? await repository.getPersonalStand(scope, ref.standId) : undefined;

  const mappingKey = `recover-stand:${JSON.stringify([
    originalScope.profileId, scope.profileId, scope.eventId, ref.source, ref.standId,
  ])}`;
  const mappedId = await repository.sync.existingMapping(mappingKey);

  if (mappedId !== undefined) {
    const mapped = await repository.getPersonalStand(scope, mappedId);

    if (mapped?.lastValid?.deletedAt === null) {
      return {
        source: "personal",
        eventId: scope.eventId,
        standId: mappedId,
      };
    }
  }
  if (!forceNew && ((ref.source === "catalog" && configured !== undefined)
    || (ref.source === "personal" && personal?.lastValid?.deletedAt === null))) {
    return {
      ...ref,
      eventId: scope.eventId,
    };
  }
  const id = await repository.sync.mappedId(`recover-stand:${JSON.stringify([
    originalScope.profileId, scope.profileId, scope.eventId, ref.source, ref.standId,
  ])}`);
  const source = recovery.stand?.input;

  await repository.savePersonalStand(scope, id, {
    name: source?.name.trim() === "" ? "Stand recuperato" : source?.name ?? configured?.name ?? "Stand recuperato",
    description: source?.description ?? configured?.description ?? "",
    categoryIds: source?.categoryIds ?? configured?.categoryIds ?? [],
    hall: source?.hall ?? null,
    booth: source?.booth ?? "",
  });

  return {
    source: "personal",
    eventId: scope.eventId,
    standId: id,
  };
}

function recoveredAnswers(input: ProductInput): string {
  return (input.questionnaireInputs ?? []).map((entry) => `${entry.definitionSnapshot.title}\n${entry.definitionSnapshot.questions.map((question) => `${question.label}: ${answerLabel(question, entry.answers[question.id])}`).join("\n")}`).join("\n\n");
}

export async function recoverAsNew(repository: LocalRepository, operationId: string): Promise<{
  profileId: string;
  eventId?: string;
  href: string;
}> {
  const entry = await repository.sync.recovery(operationId);

  if (entry === undefined) {
    throw new Error("Dati di recupero non disponibili.");
  }
  const operation = entry.operation;
  const profileId = await recoverProfile(repository, operation.profileId);

  if (operation.entityType === "profile") {
    const id = profileId === operation.profileId ? await repository.sync.mappedId(`recover-profile-identity:${profileId}`, "usr-") : profileId;

    await repository.savePersonalProfile(id, {
      name: `${operation.payload.name} recuperato`,
      color: operation.payload.color,
    });
    await repository.sync.resolveRecovery(operation);

    return {
      profileId: id,
      href: "/profiles",
    };
  }
  if (operation.entityType === "budget") {
    let amount: string | null | undefined;

    if (!operation.payload.removed) {
      amount = operation.payload.amount === null ? null : String(operation.payload.amount);
    }
    if (profileId === operation.profileId) {
      await repository.sync.retryOperation(operationId);

      return {
        profileId,
        href: "/profile/budgets",
      };
    }
    await repository.setBudget(
      profileId,
      operation.payload.categoryId,
      amount,
    );
    await repository.sync.resolveRecovery(operation);

    return {
      profileId,
      href: "/profile/budgets",
    };
  }
  const originalScope = {
    profileId: operation.profileId,
    eventId: operation.eventId,
  };
  const scope = {
    ...originalScope,
    profileId,
  };

  if (operation.entityType === "personal-stand" || operation.entityType === "stand-preferences") {
    const ref: StandReference = operation.entityType === "personal-stand"
      ? {
        source: "personal",
        eventId: scope.eventId,
        standId: operation.entityId,
      } : operation.payload.standRef;
    const stand = await recoverStand(
      repository,
      originalScope,
      scope,
      ref,
      entry,
      operation.entityType === "personal-stand",
    );

    if (operation.entityType === "stand-preferences") {
      await repository.saveStandPreferences(scope, stand.standId, {
        notes: operation.payload.notes ?? "",
        interested: operation.payload.interested ?? true,
        priority: operation.payload.priority ?? null,
        visitStatus: operation.payload.visitStatus ?? "to_visit",
      }, stand.source);
    }
    if (operation.entityType === "stand-preferences") {
      const catalog = await repository.getCatalog();
      const seed = catalog?.interests.find((item) => item.profileId === operation.profileId
        && item.standRef.eventId === operation.eventId
        && item.standRef.standId === operation.payload.standRef.standId);
      const checklist = operation.payload.checklist ?? seed?.checklist ?? [];
      const preferences = await repository.listStandPreferences(scope);
      const previous = preferences.find((item) => item.standRef.source === stand.source
        && item.standRef.standId === stand.standId);

      for (const item of checklist) {
        if (!(previous?.checklist ?? []).some((saved) => saved.id === item.id)) {
          await repository.saveStandPreferences(scope, stand.standId, {
            addChecklistItem: item,
          }, stand.source);
        }
        if (operation.payload.checklistDone?.[item.id] === true) {
          await repository.saveStandPreferences(
            scope,
            stand.standId,
            {
              checklistChange: {
                id: item.id,
                checked: true,
              },
            },
            stand.source,
          );
        }
      }
    }
    await repository.sync.resolveRecovery(operation);

    return {
      ...scope,
      href: `/stands/${stand.source === "personal" ? "personal/" : ""}${encodeURIComponent(stand.standId)}`,
    };
  }
  const source = entry.product;
  const valid = source?.lastValid ?? (operation.entityType === "product" ? operation.payload : undefined);

  if (valid === undefined) {
    throw new Error("Completa il prodotto originale prima del recupero.");
  }
  const oldProductId = valid.id;
  const existing = await repository.getProduct(scope, oldProductId);
  const reuseParent = operation.entityType === "photo" && existing?.lastValid !== null
    && existing?.lastValid !== undefined
    && (existing.lastValid.deletedAt === null || existing.lastValid.deletedAt === undefined);
  const id = reuseParent ? oldProductId : await repository.sync.mappedId(`recover-product:${JSON.stringify([
    originalScope.profileId, scope.profileId, scope.eventId, oldProductId,
  ])}`);
  let input: ProductInput = source?.input ?? productInput(valid);

  if (!reuseParent) {
    const standRef = await recoverStand(repository, originalScope, scope, valid.standRef, entry);

    if (profileId !== operation.profileId) {
      const answers = recoveredAnswers(input);

      input = {
        ...input,
        description: `${input.description}${answers === "" ? "" : `\n\nRisposte recuperate:\n${answers}`}`,
        questionnaireInputs: [],
      };
    }
    await repository.restoreProduct(scope, id, {
      ...input,
      standRef,
      plannedProductId: null,
    });
  }
  const photos = entry.photos ?? await repository.listPhotos(originalScope);

  for (const photo of photos.filter((candidate) => candidate.productId === oldProductId
    && (candidate.deletedAt === null || (operation.entityType === "photo" && candidate.id === operation.entityId)))) {
    const asset = await repository.getPhotoAsset(originalScope, photo.id);

    if (asset !== undefined) {
      const photoId = await repository.sync.mappedId(`recover-photo:${JSON.stringify([
        scope.profileId, scope.eventId, id, photo.id,
      ])}`);

      await repository.addProductPhoto(scope, id, photoId, asset, input);
      if (photo.isPrimary) {
        await repository.changeProductPhoto(scope, id, photoId, "primary");
      }
    }
  }
  await repository.sync.resolveRecovery(operation, operation.entityType === "product");

  return {
    ...scope,
    href: `/products/${encodeURIComponent(id)}`,
  };
}
