/**
 * Demo data store - in-memory store for MVP when Firestore is not configured
 * Seed script populates this; API routes and app read from it
 */

import type {
  RawEvent,
  SuggestedEntry,
  TimeEntry,
  Case,
  Contact,
  UserSettings,
} from "@/types";

/** Draft message id → last observed lastModifiedDateTime (Outlook Graph) across sync runs */
export type OutlookDraftSyncSnapshots = Record<string, string>;

export const demoStore = {
  outlookDraftSnapshots: {} as Record<string, OutlookDraftSyncSnapshots>,
  rawEvents: [] as RawEvent[],
  suggestedEntries: [] as SuggestedEntry[],
  timeEntries: [] as TimeEntry[],
  cases: [] as Case[],
  contacts: [] as Contact[],
  settings: {} as Record<string, UserSettings>,
};

export function getDemoUserId(): string {
  return "demo-user";
}
