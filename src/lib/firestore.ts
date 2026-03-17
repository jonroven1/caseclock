/**
 * Firestore collection names and helper functions
 */

export const COLLECTIONS = {
  USERS: "users",
  CASES: "cases",
  CONTACTS: "contacts",
  RAW_EVENTS: "raw_events",
  SUGGESTED_ENTRIES: "suggested_entries",
  TIME_ENTRIES: "time_entries",
  SETTINGS: "settings",
  OUTLOOK_TOKENS: "outlook_tokens",
} as const;

/** Convert Firestore Timestamp to Date */
export function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date();
}
