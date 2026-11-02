import type { ChecklistSeedItem, StandReference } from "./catalog";

export type LocalContext = {
  profileId: string;
  eventId: string;
};

export type ProductInput = {
  name: string;
  categoryId: string | null;
  standRef: StandReference | null;
  description: string;
};

export type ProductData = LocalContext & {
  id: string;
  name: string;
  categoryId: string;
  standRef: StandReference;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductIssues = Partial<Record<"name" | "categoryId" | "standRef", string>>;

export type LocalProduct = LocalContext & {
  id: string;
  input: ProductInput;
  lastValid: ProductData | null;
  issues: ProductIssues;
  localSequence: number;
  serverRevision: number | null;
  latestOperationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VisitStatus = "to_visit" | "visited" | "to_revisit";

export type StandPreferencesData = LocalContext & {
  standRef: StandReference;
  interested?: boolean;
  priority?: number | null;
  visitStatus?: VisitStatus;
  checklist?: ChecklistSeedItem[];
  checklistDone?: Record<string, boolean>;
  notes?: string;
};

export type StandPreferencesPatch = Pick<StandPreferencesData, "interested" | "priority" | "visitStatus" | "notes"> & {
  checklistChange?: {
    id: string;
    checked: boolean;
  };
  addChecklistItem?: ChecklistSeedItem;
};

export type LocalStandPreferences = StandPreferencesData & {
  localSequence: number;
  serverRevision: number | null;
  latestOperationId: string;
  updatedAt: string;
};

type OutboxMetadata = LocalContext & {
  operationId: string;
  entityId: string;
  action: "create" | "update";
  localSequence: number;
  baseRevision: number | null;
  dependsOn: string[];
  status: "pending";
  queuedAt: string;
};

export type OutboxOperation = OutboxMetadata & (
  | {
    entityType: "product";
    payload: ProductData;
  }
  | {
    entityType: "stand-preferences";
    payload: StandPreferencesData;
  }
);
