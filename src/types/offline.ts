import type { StandReference } from "./catalog";

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

export type OutboxOperation = LocalContext & {
  operationId: string;
  entityType: "product";
  entityId: string;
  action: "create" | "update";
  localSequence: number;
  baseRevision: number | null;
  dependsOn: string[];
  payload: ProductData;
  status: "pending";
  queuedAt: string;
};
