/**
 * Add external emails from an event to a case when the event is matched.
 * Excludes internal emails (same domain as user, e.g. jon@calljonnylaw.com and becca@calljonnylaw.com).
 */

import type { Case, RawEvent } from "@/types";

function getDomain(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : "";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Extract external (non-internal) emails from an email event.
 * Internal = same domain as userEmail (e.g. @calljonnylaw.com).
 */
export function getExternalEmailsFromEvent(
  event: RawEvent,
  userEmail: string | undefined
): string[] {
  if (
    event.type !== "email_received" &&
    event.type !== "email_reply_sent" &&
    event.type !== "email_read_estimated" &&
    event.type !== "email_draft_edited"
  ) {
    return [];
  }
  const meta = event.metadata ?? {};
  const from = (meta.from ?? meta.email ?? "") as string;
  const to = (meta.to ?? "") as string;
  const candidates = [from, to].filter(Boolean).map((e) => e.trim().toLowerCase());

  if (!userEmail || !userEmail.includes("@")) {
    return [...new Set(candidates.filter(isValidEmail))];
  }

  const userDomain = getDomain(userEmail);
  if (!userDomain) {
    return [...new Set(candidates.filter(isValidEmail))];
  }

  return [
    ...new Set(
      candidates.filter(
        (e) => isValidEmail(e) && getDomain(e) !== userDomain
      )
    ),
  ];
}

/**
 * Merge new external emails into a case's emails array.
 * Dedupes, excludes internal, keeps max 6.
 */
export function mergeExternalEmailsIntoCase(
  caseData: Case,
  newEmails: string[]
): Case | null {
  const existing = (caseData.emails ?? []).map((e) => e.toLowerCase().trim());
  const existingSet = new Set(existing);
  const toAdd = newEmails.filter((e) => !existingSet.has(e));
  if (toAdd.length === 0) return null;

  const merged = [...existing, ...toAdd].slice(0, 6);
  return { ...caseData, emails: merged };
}
