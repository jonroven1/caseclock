import { createHash } from "node:crypto";

/** Deterministic Firestore doc id so engagement milestones dedupe across sync retries. */
export function outlookStableEventDocId(
  kind: string,
  userId: string,
  parts: string[]
): string {
  const h = createHash("sha256")
    .update([userId, kind, ...parts].join("|"))
    .digest("hex")
    .slice(0, 32);
  return `${kind}_${h}`;
}
