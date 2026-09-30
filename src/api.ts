import { anyApi } from 'convex/server';

/**
 * The server functions live in the private app repo (app/convex/admin.ts),
 * so this site has no generated types. These shapes mirror what those
 * functions return; keep them in step when admin.ts changes.
 */
export const api = anyApi;

export type Status = 'open' | 'planned' | 'done';

export type Idea = {
  id: string;
  text: string;
  votes: number;
  reports: number;
  hidden: boolean;
  status: Status;
  createdAt: number;
};

export type Feedback = { id: string; text: string; createdAt: number };

export type Reported = {
  entryId: number;
  name: string;
  value: string;
  hospital: string;
  count: number;
  lastReportedAt: number;
};

export type RevenueChart = {
  chart: 'revenue' | 'mrr' | 'actives' | 'actives_movement' | 'customers_active' | 'customers_new';
  measures: { name: string; unit: string }[];
  /** `s` indexes `segments` on a split chart; the total has none. */
  points: { t: number; m: number; v: number; incomplete: boolean; s?: number }[];
  /** RevenueCat's plan lengths: "P1M", "P1Y". */
  segments?: string[];
  currency?: string;
  fetchedAt: number;
};

export type Overview = {
  numbers: number;
  hospitals: number;
  reported: { count: number; since24h: number };
  ideas: { total: number; noStatus: number; hiddenByReports: number; top: { id: string; text: string; votes: number }[] };
  feedback: { total: number; lastWeek: number };
  /** `day` marks a whole day's count, which has no time of its own. */
  activity: { kind: 'notWorking' | 'edit' | 'idea' | 'feedback' | 'proJoin' | 'proEnd'; text: string; at: number; day: boolean }[];
  revenue: RevenueChart[];
};
