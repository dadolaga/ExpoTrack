import type { PersonalProfile } from "./catalog";
import type {
  OutboxOperation, ProductData, PersonalStandData, StandPreferencesData, BudgetOverride,
  LocalProduct, LocalPersonalStand,
} from "./offline";
import type { LocalPhoto, PhotoData } from "./photos";

export type ProfileData = PersonalProfile & {
  deletedAt: string | null;
};
export type BudgetData = Pick<BudgetOverride, "profileId" | "categoryId" | "amount" | "currency" | "removed">;
export type SyncEntity
  = | {
    entityType: "profile";
    data: ProfileData;
  }
  | {
    entityType: "budget";
    data: BudgetData;
  }
  | {
    entityType: "product";
    data: ProductData;
  }
  | {
    entityType: "personal-stand";
    data: PersonalStandData;
  }
  | {
    entityType: "stand-preferences";
    data: StandPreferencesData;
  }
  | {
    entityType: "photo";
    data: PhotoData;
  };

export type SyncChange = SyncEntity & {
  profileId: string;
  eventId: string | null;
  entityId: string;
  revision: number;
  mediaStatus?: "pending" | "ready";
};

export type PushResult = {
  operationId: string;
  status: "accepted" | "rejected" | "retry";
  code?: string;
  current?: SyncChange;
};

export type PullPage = {
  changes: SyncChange[];
  cursor: string;
  hasMore: boolean;
};

export type SyncRecovery = {
  operationId: string;
  operation: OutboxOperation;
  code: string;
  product?: LocalProduct;
  photos?: LocalPhoto[];
  stand?: LocalPersonalStand;
  recoveredId?: string;
  resolved?: boolean;
};

export type SyncSummary = {
  pending: OutboxOperation[];
  recoveries: SyncRecovery[];
  localPhotos: number;
  missingPhotos: number;
  lastSyncedAt: string | null;
};

export type SyncStatus = {
  phase: "idle" | "syncing" | "offline" | "error";
  reachable: boolean | null;
  message: string | null;
  progress: string | null;
  summary: SyncSummary;
};
