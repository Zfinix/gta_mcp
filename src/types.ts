export interface Method {
  id: string;
  name: string;
  category: "heist" | "business" | "active" | "passive" | "cargo";
  solo: boolean;
  estPerHour: number;
  payoutMin: number;
  payoutMax: number;
  estMinutes: number | null;
  setupCost: number;
  buyIn: number;
  cooldownMinutes: number;
  weeklyLimit?: number;
  bonusEligible: boolean;
  requires: string[];
  notes: string;
  tips?: string[];
}

export interface Business {
  id: string;
  name: string;
  category: string;
  fillMinutes: number;
  supplyCost: number;
  fullValueLocal: number;
  fullValueFar: number;
  soloSellable: boolean;
  soloSellLimitValue: number;
  estPerHour: number;
  feedsNightclub: boolean;
  mansionBoostEligible: boolean;
  hasOwnDailyBoost?: boolean;
  boostedBy?: string;
  buyIn: number;
  notes: string;
}

export interface Collectible {
  id: string;
  name: string;
  kind: "daily" | "oneTime";
  countPerDay?: number;
  count?: number;
  payoutEach?: number;
  dailyTotal?: number;
  rewardTotal?: number;
  resets: string;
  gtalensSlug?: string;
  notes: string;
}

export interface Recurring {
  id: string;
  name: string;
  payout: number;
  streak7?: number;
  streak28?: number;
  weeklyBonus?: number;
  resets: string;
  notes: string;
}

export interface Property {
  id: string;
  name: string;
  costMin: number;
  costMax: number;
  unlocks: string[];
  buyPriority: number;
}

export interface MapCategory {
  slug: string;
  name: string;
  group: string;
  money: boolean;
  daily: boolean;
}

export interface ReferenceData {
  meta: Record<string, unknown>;
  resets: {
    dailyUtcHour: number;
    weeklyUtcDay: number;
    weeklyUtcHour: number;
    inGameDayMinutes: number;
    note: string;
  };
  methods: Method[];
  businesses: Business[];
  collectibles: Collectible[];
  recurring: Recurring[];
  properties: Property[];
  mansion: Record<string, any>;
}

/** Persisted player business state for "run my businesses". */
export interface BusinessState {
  /** business id -> tracked state */
  businesses: Record<string, OwnedBusiness>;
  /** ISO timestamp of last update */
  updatedAt: string;
}

export interface OwnedBusiness {
  id: string;
  /** stock as a fraction 0..1 at lastSyncedAt (optional) */
  stockFraction?: number;
  /** ISO time the stock fraction was recorded / supplies (re)started */
  lastResupplyAt?: string;
  /** ISO time of the last sale */
  lastSoldAt?: string;
  /** has the production/equipment upgrade */
  upgraded?: boolean;
  notes?: string;
}
