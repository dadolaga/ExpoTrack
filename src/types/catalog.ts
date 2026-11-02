export type StandReference = {
  source: "catalog" | "personal";
  eventId: string;
  standId: string;
};

export type CatalogEvent = {
  id: string;
  name: string;
  standsFile: string;
  enabled: boolean;
};

export type AppConfig = {
  schemaVersion: 1;
  app: {
    name: string;
    defaultLocale: "it-IT";
    defaultEventId: string;
  };
  configFiles: {
    profiles: string;
    pavilions: string;
    categories: string;
  };
  events: CatalogEvent[];
};

export type BudgetSeed = {
  categoryId: string;
  amount: number;
  currency: "EUR";
};

export type ConfiguredProfile = {
  id: string;
  origin: "json";
  name: string;
  color: string;
  icon: string;
  enabled: boolean;
  budgets: BudgetSeed[];
};

export type Category = {
  id: string;
  name: string;
  parentId?: string;
  sortOrder?: number;
};

export type Pavilion = {
  eventId: string;
  id: string;
  name: string;
  code?: string;
  description?: string;
  sortOrder?: number;
};

export type CatalogStand = {
  id: string;
  eventId: string;
  name: string;
  categoryIds: string[];
  description?: string;
  hall?: string;
  booth?: string;
};

export type ChecklistSeedItem = {
  id: string;
  text: string;
};

export type InterestSeed = {
  profileId: string;
  standRef: StandReference & {
    source: "catalog";
  };
  priority?: number;
  checklist: ChecklistSeedItem[];
};

export type PlannedProduct = {
  id: string;
  profileId: string;
  standRef: StandReference & {
    source: "catalog";
  };
  name: string;
  categoryId: string;
  description?: string;
};

type QuestionBase = {
  id: string;
  label: string;
  helpText?: string;
};

export type QuestionOption = {
  id: string;
  label: string;
};

export type Question = QuestionBase & (
  | {
    type: "text";
    placeholder?: string;
  }
  | {
    type: "number";
    min?: number;
    max?: number;
    step?: number;
  }
  | {
    type: "boolean";
  }
  | {
    type: "rating_1_10";
  }
  | {
    type: "single_choice";
    options: QuestionOption[];
  }
  | {
    type: "multiple_choice";
    options: QuestionOption[];
  }
);

export type Questionnaire = {
  id: string;
  profileId: string;
  categoryId: string;
  version: number;
  title: string;
  description?: string;
  questions: Question[];
};

export type CatalogSnapshot = {
  config: AppConfig;
  profiles: ConfiguredProfile[];
  categories: Category[];
  pavilions: Pavilion[];
  stands: CatalogStand[];
  interests: InterestSeed[];
  plannedProducts: PlannedProduct[];
  questionnaires: Questionnaire[];
};
