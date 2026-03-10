/**
 * Legal email billing heuristics - testable helper functions
 *
 * Rules:
 * - Single reply: default 0.1 hrs unless stronger evidence supports more
 * - Multiple replies in one thread within 30 min: cluster and suggest 0.2 or 0.3
 * - Reply with attachment or following document-open: increase confidence and time
 * - Do not bill full gap between email received and reply if other events exist
 * - Match to cases via contact email, thread metadata, subject line
 */

import type { RawEvent, Case, Contact } from "@/types";

/** Default tenths for a single email reply */
export const DEFAULT_REPLY_TENTHS = 0.1;

/** Cluster window: replies within this many minutes are grouped */
export const CLUSTER_WINDOW_MINUTES = 30;

/** Max suggested tenths for a clustered thread */
export const MAX_CLUSTER_TENTHS = 0.5;

/** Confidence boost when reply has attachment or follows document-open */
export const STRONG_EVIDENCE_CONFIDENCE_BOOST = 0.1;

/** Tenths boost when reply has attachment or follows document-open */
export const STRONG_EVIDENCE_TENTHS_BOOST = 0.1;

/** Time window (minutes) to consider a document-open as "preceding" a reply */
export const DOC_OPEN_PRECEDING_WINDOW_MINUTES = 15;

// --- Testable helpers ---

/**
 * Check if an email reply event has an attachment (via metadata)
 */
export function hasAttachment(event: RawEvent): boolean {
  const meta = event.metadata ?? {};
  const count = meta.attachmentCount as number | undefined;
  const has = meta.hasAttachment as boolean | undefined;
  return (typeof count === "number" && count > 0) || has === true;
}

/**
 * Check if a reply follows a document-open event within the preceding window
 */
export function followsDocumentOpen(
  reply: RawEvent,
  allEvents: RawEvent[],
  windowMinutes: number = DOC_OPEN_PRECEDING_WINDOW_MINUTES
): boolean {
  const replyTime = new Date(reply.timestampStart).getTime();
  const windowMs = windowMinutes * 60 * 1000;

  return allEvents.some((e) => {
    if (e.type !== "document_open") return false;
    const docTime = new Date(e.timestampStart).getTime();
    return docTime < replyTime && replyTime - docTime <= windowMs;
  });
}

/**
 * Get events that occur between an email received and a reply sent.
 * Used to avoid billing the full gap when other work happened in between.
 */
export function getEventsBetween(
  received: RawEvent,
  reply: RawEvent,
  allEvents: RawEvent[]
): RawEvent[] {
  const receivedTime = new Date(received.timestampStart).getTime();
  const replyTime = new Date(reply.timestampStart).getTime();

  return allEvents.filter((e) => {
    if (e.id === received.id || e.id === reply.id) return false;
    const t = new Date(e.timestampStart).getTime();
    return t > receivedTime && t < replyTime;
  });
}

/**
 * Whether we should avoid billing the full time gap between received and reply.
 * True if other events exist between them (do not assume continuous work).
 */
export function hasInterveningEvents(
  received: RawEvent,
  reply: RawEvent,
  allEvents: RawEvent[]
): boolean {
  return getEventsBetween(received, reply, allEvents).length > 0;
}

/**
 * Find the most recent email_received before a reply, preferably in same thread.
 * Used to check for intervening events (do not bill full gap).
 */
export function findCorrespondingReceived(
  reply: RawEvent,
  allEvents: RawEvent[]
): RawEvent | undefined {
  const replyTime = new Date(reply.timestampStart).getTime();
  const replyThreadId = reply.metadata?.threadId as string | undefined;

  const received = allEvents
    .filter((e) => e.type === "email_received")
    .filter((e) => new Date(e.timestampStart).getTime() < replyTime)
    .sort(
      (a, b) =>
        new Date(b.timestampStart).getTime() -
        new Date(a.timestampStart).getTime()
    );

  const sameThread = received.find(
    (e) => (e.metadata?.threadId as string) === replyThreadId
  );
  return sameThread ?? received[0];
}

/**
 * Confidence reduction when other events exist between received and reply.
 * We do not bill the full gap; this lowers confidence that the reply took
 * the full suggested time.
 */
export const INTERVENING_EVENTS_CONFIDENCE_PENALTY = 0.1;

/**
 * Match an email event to a case using:
 * - Contact email (from, to in metadata)
 * - Thread metadata (threadId, subject)
 * - Subject line / title containing case or client name
 */
export function matchEmailToCase(
  event: RawEvent,
  cases: Case[],
  contacts: Contact[]
): string | undefined {
  if (event.linkedCaseId) return event.linkedCaseId;

  const meta = event.metadata ?? {};
  const title = (event.title ?? "").toLowerCase();
  const threadId = meta.threadId as string | undefined;

  // Match by contact email (from or to)
  const from = (meta.from ?? meta.email ?? "") as string;
  const to = (meta.to ?? "") as string;
  const emails = [from, to].filter(Boolean);

  for (const email of emails) {
    const contact = contacts.find(
      (c) => c.email && c.email.toLowerCase() === email.toLowerCase()
    );
    if (contact) return contact.caseId;
  }

  // Match by case/client name in subject/title
  for (const c of cases) {
    const caseName = c.caseName.toLowerCase();
    const clientName = c.clientName.toLowerCase();
    if (title.includes(caseName) || title.includes(clientName)) return c.id;
  }

  // Thread metadata could be used for future thread-to-case mapping
  if (threadId) {
    // Placeholder: could look up threadId -> caseId from a mapping table
  }

  return undefined;
}

/**
 * Compute suggested tenths for a single reply.
 * Default 0.1 unless attachment or document-open supports more.
 */
export function getSingleReplyTenths(
  reply: RawEvent,
  allEvents: RawEvent[],
  defaultTenths: number = DEFAULT_REPLY_TENTHS
): number {
  const hasStrongEvidence =
    hasAttachment(reply) ||
    followsDocumentOpen(reply, allEvents);

  if (hasStrongEvidence) {
    return Math.min(
      defaultTenths + STRONG_EVIDENCE_TENTHS_BOOST,
      0.3
    );
  }
  return defaultTenths;
}

/**
 * Compute confidence for a single reply.
 * Higher when attachment or document-open present.
 */
export function getSingleReplyConfidence(
  reply: RawEvent,
  allEvents: RawEvent[],
  baseConfidence: number = 0.8
): number {
  const hasStrongEvidence =
    hasAttachment(reply) ||
    followsDocumentOpen(reply, allEvents);

  if (hasStrongEvidence) {
    return Math.min(
      baseConfidence + STRONG_EVIDENCE_CONFIDENCE_BOOST,
      0.95
    );
  }
  return baseConfidence;
}

/**
 * Cluster email replies by thread and time.
 * Replies in the same thread within CLUSTER_WINDOW_MINUTES are grouped.
 */
export function clusterRepliesByThread(
  replies: RawEvent[],
  windowMinutes: number = CLUSTER_WINDOW_MINUTES
): RawEvent[][] {
  const sorted = [...replies].sort(
    (a, b) =>
      new Date(a.timestampStart).getTime() -
      new Date(b.timestampStart).getTime()
  );

  const windowMs = windowMinutes * 60 * 1000;
  const clusters: RawEvent[][] = [];
  let current: RawEvent[] = [];

  for (const r of sorted) {
    const t = new Date(r.timestampStart).getTime();
    const last = current[current.length - 1];
    const lastT = last ? new Date(last.timestampStart).getTime() : 0;
    const sameThread =
      last &&
      (r.metadata?.threadId === last.metadata?.threadId ||
        (r.metadata?.threadId && last.metadata?.threadId));

    if (
      current.length === 0 ||
      (t - lastT <= windowMs && (sameThread || !r.metadata?.threadId))
    ) {
      current.push(r);
    } else {
      if (current.length > 0) clusters.push([...current]);
      current = [r];
    }
  }
  if (current.length > 0) clusters.push(current);

  return clusters;
}

/**
 * Get suggested tenths for a cluster of replies.
 * 2 replies -> 0.2, 3 -> 0.3, capped at MAX_CLUSTER_TENTHS.
 * Uses integer math to avoid floating-point precision issues.
 */
export function getClusterTenths(
  cluster: RawEvent[],
  defaultTenths: number = DEFAULT_REPLY_TENTHS
): number {
  if (cluster.length <= 1) return defaultTenths;
  const rawTenths = Math.round(cluster.length * defaultTenths * 10);
  const tenths = Math.ceil(rawTenths) / 10;
  return Math.min(tenths, MAX_CLUSTER_TENTHS);
}
