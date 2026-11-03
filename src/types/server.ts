import type { CatalogSnapshot, ConfiguredProfile, PersonalProfile } from "./catalog";
import type {
  BudgetOverride, PersonalStandData, ProductData, StandPreferencesData,
} from "./offline";
import type { PhotoData } from "./photos";

export type Bootstrap = {
  schemaVersion: 1;
  configHash: string;
  catalog: CatalogSnapshot;
};

export type ServerRecord<T> = {
  data: T;
  revision: number;
};

export type ServerProfile = ServerRecord<ConfiguredProfile | PersonalProfile> & {
  deletedAt: string | null;
  available: boolean;
};

export type ServerCollection = {
  profileId: string;
  eventId: string;
  revision: number;
  products: ServerRecord<ProductData>[];
  personalStands: ServerRecord<PersonalStandData>[];
  standPreferences: ServerRecord<StandPreferencesData>[];
  budgets: ServerRecord<Pick<
    BudgetOverride, "profileId" | "categoryId" | "amount" | "currency" | "removed"
  >>[];
  photos: (ServerRecord<PhotoData> & {
    mediaStatus: "pending" | "ready";
  })[];
};
