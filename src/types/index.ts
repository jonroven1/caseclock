/**
 * CaseClock - TypeScript types for Firestore collections and app state
 */

// --- User ---
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date | string;
}

// --- Case ---
export interface Case {
  id: string;
  userId: string;
  caseName: string;
  matterNumber: string;
  clientName: string;
  status: "active" | "closed" | "pending";
  createdAt: Date | string;
}

// --- Contact ---
export interface Contact {
  id: string;
  userId: string;
  caseId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

// --- Raw Event Sources ---
export type RawEventSource =
  | "email"
  | "calendar"
  | "call"
  | "location"
  | "document"
  | "manual";

// --- Raw Event Types ---
export type RawEventType =
  | "email_received"
  | "email_reply_sent"
  | "calendar_event"
  | "phone_call"
  | "travel"
  | "document_open"
  | "manual_entry";

// --- Raw Event ---
export interface RawEvent {
  id: string;
  userId: string;
  source: RawEventSource;
  type: RawEventType;
  title: string;
  description?: string;
  timestampStart: Date | string;
  timestampEnd?: Date | string;
  metadata?: Record<string, unknown>;
  linkedCaseId?: string;
  confidence?: number; // 0-1
  createdAt: Date | string;
}

// --- Suggested Entry Status ---
export type SuggestedEntryStatus =
  | "suggested"
  | "approved"
  | "rejected"
  | "edited";

// --- Suggested Entry ---
export interface SuggestedEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO or HH:mm
  endTime: string;
  durationHoursTenths: number; // 0.1, 0.2, etc.
  description: string;
  caseId?: string;
  sourceEventIds: string[];
  confidence: number;
  status: SuggestedEntryStatus;
  billable?: boolean; // default true when approving
  createdAt: Date | string;
  updatedAt: Date | string;
}

// --- Time Entry ---
export interface TimeEntry {
  id: string;
  userId: string;
  caseId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHoursTenths: number;
  description: string;
  billable: boolean;
  sourceSuggestedEntryId?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// --- Settings ---
export interface UserSettings {
  userId: string;
  roundCallsToTenth: boolean;
  defaultReplyTenths: number;
  defaultTravelBilling: number;
  autoApproveCalendarEvents: boolean;
  timezone: string;
}

// --- Webhook payload types ---
export interface EmailEventPayload {
  type: "email_received" | "email_reply_sent";
  subject?: string;
  body?: string;
  from?: string;
  to?: string;
  threadId?: string;
  timestamp: string;
  hasAttachment?: boolean;
  attachmentCount?: number;
  metadata?: Record<string, unknown>;
}

export interface CalendarEventPayload {
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
  metadata?: Record<string, unknown>;
}

export interface CallEventPayload {
  phoneNumber?: string;
  direction?: "inbound" | "outbound";
  durationSeconds: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface LocationEventPayload {
  type: "travel_start" | "travel_end" | "arrival";
  location?: string;
  destinationType?: "court" | "deposition" | "office" | "client_site" | "other";
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentEventPayload {
  documentName: string;
  documentType?: string;
  action?: "open" | "edit" | "close";
  timestamp: string;
  metadata?: Record<string, unknown>;
}
