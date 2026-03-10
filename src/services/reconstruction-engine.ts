/**
 * CaseClock Reconstruction Engine
 *
 * Takes raw events for a day, sorts them chronologically, clusters related events,
 * and generates suggested billable time entries using configurable heuristics.
 *
 * Design: Modular and easy to extend. Each heuristic is a separate function.
 * Email heuristics live in @/lib/email-billing-heuristics for testability.
 */

import type {
  RawEvent,
  SuggestedEntry,
  UserSettings,
  Case,
  Contact,
} from "@/types";
import {
  matchEmailToCase,
  clusterRepliesByThread,
  getSingleReplyTenths,
  getSingleReplyConfidence,
  getClusterTenths,
  findCorrespondingReceived,
  hasInterveningEvents,
  INTERVENING_EVENTS_CONFIDENCE_PENALTY,
  hasAttachment,
  followsDocumentOpen,
  CLUSTER_WINDOW_MINUTES,
} from "@/lib/email-billing-heuristics";

export interface ReconstructionInput {
  rawEvents: RawEvent[];
  cases: Case[];
  contacts: Contact[];
  settings: UserSettings;
  date: string; // YYYY-MM-DD
  userId: string;
}

export interface ReconstructionResult {
  suggestedEntries: SuggestedEntry[];
  appliedHeuristics: string[];
}

const DEFAULT_SETTINGS: Partial<UserSettings> = {
  defaultReplyTenths: 0.1,
  defaultTravelBilling: 0.5,
  roundCallsToTenth: true,
  autoApproveCalendarEvents: false,
};

/**
 * Round duration in hours to nearest 0.1 (tenth-hour billing)
 */
function roundToTenth(hours: number): number {
  return Math.ceil(hours * 10) / 10;
}

/**
 * Round duration up to nearest 0.1
 */
function roundUpToTenth(hours: number): number {
  return Math.ceil(hours * 10) / 10;
}

/**
 * Generate a unique ID for suggested entries
 */
function generateId(): string {
  return `sug_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Try to link an event to a case using contacts and metadata.
 * Email events use matchEmailToCase (contact email, thread, subject).
 */
function linkEventToCase(
  event: RawEvent,
  cases: Case[],
  contacts: Contact[]
): string | undefined {
  if (event.linkedCaseId) return event.linkedCaseId;

  // Email events use dedicated matching (contact email, thread, subject)
  if (event.type === "email_received" || event.type === "email_reply_sent") {
    return matchEmailToCase(event, cases, contacts);
  }

  const meta = event.metadata ?? {};
  const title = (event.title ?? "").toLowerCase();
  const desc = (event.description ?? "").toLowerCase();

  // Match by contact email
  const email = (meta.email ?? meta.from ?? meta.to ?? "") as string;
  if (email) {
    const contact = contacts.find(
      (c) => c.email && c.email.toLowerCase() === email.toLowerCase()
    );
    if (contact) return contact.caseId;
  }

  // Match by contact phone
  const phone = (meta.phone ?? meta.phoneNumber ?? "") as string;
  if (phone) {
    const normalized = phone.replace(/\D/g, "");
    const contact = contacts.find(
      (c) => c.phone && c.phone.replace(/\D/g, "") === normalized
    );
    if (contact) return contact.caseId;
  }

  // Match by case/client name in title or description
  for (const c of cases) {
    const caseName = c.caseName.toLowerCase();
    const clientName = c.clientName.toLowerCase();
    if (title.includes(caseName) || title.includes(clientName)) return c.id;
    if (desc.includes(caseName) || desc.includes(clientName)) return c.id;
  }

  return undefined;
}

/**
 * Heuristic: Email reply - default 0.1 unless attachment/doc-open supports more.
 * Do not bill full gap when other events exist between received and reply.
 */
function heuristicEmailReply(
  events: RawEvent[],
  input: ReconstructionInput,
  allEvents: RawEvent[]
): SuggestedEntry[] {
  const entries: SuggestedEntry[] = [];
  const defaultTenths = input.settings.defaultReplyTenths ?? 0.1;

  for (const e of events) {
    if (e.type !== "email_reply_sent") continue;

    const tenths = getSingleReplyTenths(e, allEvents, defaultTenths);
    let confidence = getSingleReplyConfidence(e, allEvents, e.confidence ?? 0.8);

    // Reduce confidence when other events exist between received and reply
    const received = findCorrespondingReceived(e, allEvents);
    if (received && hasInterveningEvents(received, e, allEvents)) {
      confidence = Math.max(0.5, confidence - INTERVENING_EVENTS_CONFIDENCE_PENALTY);
    }

    const start = new Date(e.timestampStart);
    const end = new Date(start.getTime() + tenths * 60 * 60 * 1000);

    entries.push({
      id: generateId(),
      userId: input.userId,
      date: input.date,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationHoursTenths: tenths,
      description: `Email reply: ${e.title}`,
      caseId: matchEmailToCase(e, input.cases, input.contacts),
      sourceEventIds: [e.id],
      confidence,
      status: "suggested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return entries;
}

/**
 * Heuristic: Cluster multiple replies in one thread within 30 minutes.
 * Suggest 0.2 or 0.3 based on count. Boost confidence if attachment/doc-open.
 */
function heuristicEmailCluster(
  events: RawEvent[],
  input: ReconstructionInput
): SuggestedEntry[] {
  const replies = events.filter((e) => e.type === "email_reply_sent");
  const clusters = clusterRepliesByThread(replies, CLUSTER_WINDOW_MINUTES);

  const entries: SuggestedEntry[] = [];
  const defaultTenths = input.settings.defaultReplyTenths ?? 0.1;

  for (const cluster of clusters) {
    if (cluster.length === 1) continue; // Handled by single-reply heuristic

    const first = cluster[0];
    const durationTenths = getClusterTenths(cluster, defaultTenths);

    // Boost confidence if any reply has attachment or follows document-open
    let confidence = 0.75;
    const hasStrongEvidence = cluster.some(
      (r) => hasAttachment(r) || followsDocumentOpen(r, events)
    );
    if (hasStrongEvidence) confidence = 0.85;

    const start = new Date(first.timestampStart);
    const end = new Date(
      start.getTime() + durationTenths * 60 * 60 * 1000
    );

    entries.push({
      id: generateId(),
      userId: input.userId,
      date: input.date,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationHoursTenths: durationTenths,
      description: `Email thread: ${cluster.length} replies`,
      caseId: matchEmailToCase(first, input.cases, input.contacts),
      sourceEventIds: cluster.map((e) => e.id),
      confidence,
      status: "suggested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return entries;
}

/**
 * Heuristic: Calendar event - use actual duration, round to tenth
 */
function heuristicCalendar(
  events: RawEvent[],
  input: ReconstructionInput
): SuggestedEntry[] {
  const entries: SuggestedEntry[] = [];

  for (const e of events) {
    if (e.type !== "calendar_event") continue;

    const start = new Date(e.timestampStart);
    const end = e.timestampEnd
      ? new Date(e.timestampEnd)
      : new Date(start.getTime() + 60 * 60 * 1000); // default 1hr
    const durationHours =
      (end.getTime() - start.getTime()) / (60 * 60 * 1000);
    const durationTenths = roundToTenth(Math.max(0.1, durationHours));

    entries.push({
      id: generateId(),
      userId: input.userId,
      date: input.date,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationHoursTenths: durationTenths,
      description: e.title,
      caseId: linkEventToCase(e, input.cases, input.contacts),
      sourceEventIds: [e.id],
      confidence: e.confidence ?? 0.9,
      status: "suggested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return entries;
}

/**
 * Heuristic: Phone call - use actual duration, round up to tenth if configured
 */
function heuristicPhoneCall(
  events: RawEvent[],
  input: ReconstructionInput
): SuggestedEntry[] {
  const entries: SuggestedEntry[] = [];
  const roundUp = input.settings.roundCallsToTenth ?? true;

  for (const e of events) {
    if (e.type !== "phone_call") continue;

    const start = new Date(e.timestampStart);
    const meta = e.metadata ?? {};
    const durationSeconds = (meta.durationSeconds as number) ?? 0;
    const durationHours = durationSeconds / 3600;
    const durationTenths = roundUp
      ? roundUpToTenth(Math.max(0.1, durationHours))
      : roundToTenth(Math.max(0.1, durationHours));

    const end = new Date(
      start.getTime() + durationTenths * 60 * 60 * 1000
    );

    entries.push({
      id: generateId(),
      userId: input.userId,
      date: input.date,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationHoursTenths: durationTenths,
      description: `Phone call${meta.phoneNumber ? `: ${meta.phoneNumber}` : ""}`,
      caseId: linkEventToCase(e, input.cases, input.contacts),
      sourceEventIds: [e.id],
      confidence: e.confidence ?? 0.85,
      status: "suggested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return entries;
}

/**
 * Heuristic: Travel - create travel suggestion based on destination type
 */
function heuristicTravel(
  events: RawEvent[],
  input: ReconstructionInput
): SuggestedEntry[] {
  const entries: SuggestedEntry[] = [];
  const defaultTravel = input.settings.defaultTravelBilling ?? 0.5;

  const travelEvents = events.filter((e) => e.type === "travel");
  if (travelEvents.length === 0) return entries;

  // Group travel by destination type or use first/last for duration
  for (const e of travelEvents) {
    const meta = e.metadata ?? {};
    const destType = (meta.destinationType ?? "other") as string;
    const location = (meta.location ?? e.title) as string;

    const start = new Date(e.timestampStart);
    const end = e.timestampEnd
      ? new Date(e.timestampEnd)
      : new Date(start.getTime() + defaultTravel * 60 * 60 * 1000);
    const durationHours =
      (end.getTime() - start.getTime()) / (60 * 60 * 1000);
    const durationTenths = roundToTenth(Math.max(0.1, durationHours));

    const destLabel =
      destType === "court"
        ? "Travel to court"
        : destType === "deposition"
          ? "Travel to deposition"
          : destType === "client_site"
            ? "Travel to client site"
            : "Travel";

    entries.push({
      id: generateId(),
      userId: input.userId,
      date: input.date,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationHoursTenths: durationTenths,
      description: `${destLabel}${location ? `: ${location}` : ""}`,
      caseId: linkEventToCase(e, input.cases, input.contacts),
      sourceEventIds: [e.id],
      confidence: e.confidence ?? 0.7,
      status: "suggested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return entries;
}

/**
 * Heuristic: Document open - suggest 0.1 for document review
 */
function heuristicDocument(
  events: RawEvent[],
  input: ReconstructionInput
): SuggestedEntry[] {
  const entries: SuggestedEntry[] = [];

  for (const e of events) {
    if (e.type !== "document_open") continue;

    const start = new Date(e.timestampStart);
    const end = new Date(start.getTime() + 0.1 * 60 * 60 * 1000);

    entries.push({
      id: generateId(),
      userId: input.userId,
      date: input.date,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationHoursTenths: 0.1,
      description: `Document review: ${e.title}`,
      caseId: linkEventToCase(e, input.cases, input.contacts),
      sourceEventIds: [e.id],
      confidence: e.confidence ?? 0.6,
      status: "suggested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return entries;
}

/**
 * Heuristic: Manual entry - pass through as-is
 */
function heuristicManual(
  events: RawEvent[],
  input: ReconstructionInput
): SuggestedEntry[] {
  const entries: SuggestedEntry[] = [];

  for (const e of events) {
    if (e.type !== "manual_entry") continue;

    const start = new Date(e.timestampStart);
    const end = e.timestampEnd
      ? new Date(e.timestampEnd)
      : new Date(start.getTime() + 60 * 60 * 1000);
    const durationHours =
      (end.getTime() - start.getTime()) / (60 * 60 * 1000);
    const durationTenths = roundToTenth(Math.max(0.1, durationHours));

    entries.push({
      id: generateId(),
      userId: input.userId,
      date: input.date,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationHoursTenths: durationTenths,
      description: e.title,
      caseId: e.linkedCaseId ?? linkEventToCase(e, input.cases, input.contacts),
      sourceEventIds: [e.id],
      confidence: 1,
      status: "suggested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return entries;
}

/**
 * Deduplicate: if an event is already covered by a cluster, skip single-entry
 */
function deduplicateEntries(entries: SuggestedEntry[]): SuggestedEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    for (const eid of entry.sourceEventIds) {
      if (seen.has(eid)) return false;
    }
    entry.sourceEventIds.forEach((id) => seen.add(id));
    return true;
  });
}

/**
 * Main reconstruction function
 */
export function reconstructDay(input: ReconstructionInput): ReconstructionResult {
  const { rawEvents, date, settings } = input;
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const events = rawEvents
    .filter((e) => {
      const t = new Date(e.timestampStart).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    })
    .sort(
      (a, b) =>
        new Date(a.timestampStart).getTime() -
        new Date(b.timestampStart).getTime()
    );

  const inputWithSettings = { ...input, settings: mergedSettings as UserSettings };

  // Run heuristics - order matters for deduplication
  const allEntries: SuggestedEntry[] = [];
  const applied: string[] = [];

  // Cluster first (takes precedence over single replies)
  const clusterEntries = heuristicEmailCluster(events, inputWithSettings);
  if (clusterEntries.length > 0) {
    allEntries.push(...clusterEntries);
    applied.push("email_cluster");
  }

  // Single email replies (excluding those in clusters)
  const clusterEventIds = new Set(
    clusterEntries.flatMap((e) => e.sourceEventIds)
  );
  const singleReplies = events.filter(
    (e) =>
      e.type === "email_reply_sent" && !clusterEventIds.has(e.id)
  );
  const replyEntries = heuristicEmailReply(
    singleReplies,
    inputWithSettings,
    events
  );
  if (replyEntries.length > 0) {
    allEntries.push(...replyEntries);
    applied.push("email_reply");
  }

  // Calendar, call, travel, document, manual
  const calendarEntries = heuristicCalendar(events, inputWithSettings);
  if (calendarEntries.length > 0) {
    allEntries.push(...calendarEntries);
    applied.push("calendar");
  }

  const callEntries = heuristicPhoneCall(events, inputWithSettings);
  if (callEntries.length > 0) {
    allEntries.push(...callEntries);
    applied.push("phone_call");
  }

  const travelEntries = heuristicTravel(events, inputWithSettings);
  if (travelEntries.length > 0) {
    allEntries.push(...travelEntries);
    applied.push("travel");
  }

  const docEntries = heuristicDocument(events, inputWithSettings);
  if (docEntries.length > 0) {
    allEntries.push(...docEntries);
    applied.push("document");
  }

  const manualEntries = heuristicManual(events, inputWithSettings);
  if (manualEntries.length > 0) {
    allEntries.push(...manualEntries);
    applied.push("manual");
  }

  const deduped = deduplicateEntries(allEntries);
  const sorted = deduped.sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return {
    suggestedEntries: sorted,
    appliedHeuristics: [...new Set(applied)],
  };
}
