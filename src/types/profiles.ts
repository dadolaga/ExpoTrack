import type { CatalogEvent, CatalogSnapshot, ConfiguredProfile } from "./catalog";
import type { LocalContext } from "./offline";

export type ProfileSummary = Pick<ConfiguredProfile, "id" | "name" | "color" | "icon" | "enabled"> & {
  origin: "json" | "personal";
};

export type ProfileSession = {
  catalog: CatalogSnapshot;
  context: LocalContext | null;
  profile: ProfileSummary | null;
  event: CatalogEvent | null;
  invalidSelection: boolean;
};
