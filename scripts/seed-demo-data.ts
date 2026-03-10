/**
 * CaseClock Demo Data Seed Script
 *
 * Populates the demo store with:
 * - 3 cases
 * - Contacts tied to those cases
 * - One full day of events (emails, calls, calendar, travel, document)
 * - Generated suggested entries from the reconstruction engine
 *
 * Run: npx tsx scripts/seed-demo-data.ts
 */

import { demoStore } from "../src/lib/demo-store";
import { reconstructDay } from "../src/services/reconstruction-engine";
import type {
  RawEvent,
  Case,
  Contact,
  SuggestedEntry,
  UserSettings,
} from "../src/types";

const userId = "demo-user";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function seedCases(): Case[] {
  const cases: Case[] = [
    {
      id: "case_smith_v_acme",
      userId,
      caseName: "Smith v. Acme Corp",
      matterNumber: "2024-001",
      clientName: "John Smith",
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "case_jones_estate",
      userId,
      caseName: "Jones Estate Planning",
      matterNumber: "2024-002",
      clientName: "Jones Family",
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "case_metro_llc",
      userId,
      caseName: "Metro LLC Contract",
      matterNumber: "2024-003",
      clientName: "Metro LLC",
      status: "active",
      createdAt: new Date().toISOString(),
    },
  ];
  demoStore.cases = cases;
  return cases;
}

function seedContacts(cases: Case[]): Contact[] {
  const contacts: Contact[] = [
    {
      id: generateId("contact"),
      userId,
      caseId: cases[0].id,
      name: "John Smith",
      email: "john.smith@email.com",
      phone: "+1-555-0101",
      role: "Client",
    },
    {
      id: generateId("contact"),
      userId,
      caseId: cases[0].id,
      name: "Acme Legal",
      email: "legal@acme.com",
      role: "Opposing counsel",
    },
    {
      id: generateId("contact"),
      userId,
      caseId: cases[1].id,
      name: "Mary Jones",
      email: "mary.jones@email.com",
      phone: "+1-555-0102",
      role: "Client",
    },
    {
      id: generateId("contact"),
      userId,
      caseId: cases[2].id,
      name: "Metro LLC Rep",
      email: "contracts@metro.com",
      role: "Client",
    },
  ];
  demoStore.contacts = contacts;
  return contacts;
}

function seedRawEvents(date: string): RawEvent[] {
  const base = new Date(`${date}T09:00:00`);
  const ev = (type: RawEvent["type"], offsetMin: number, opts: Partial<RawEvent> = {}) => {
    const start = new Date(base.getTime() + offsetMin * 60 * 1000);
    return {
      id: generateId("evt"),
      userId,
      source: "email" as const,
      type,
      title: "",
      timestampStart: start.toISOString(),
      createdAt: new Date().toISOString(),
      ...opts,
    };
  };

  const events: RawEvent[] = [
    ev("email_received", 0, {
      source: "email",
      type: "email_received",
      title: "Re: Smith v. Acme - Discovery",
      metadata: { from: "legal@acme.com", to: "lawyer@firm.com" },
    }),
    ev("email_reply_sent", 15, {
      source: "email",
      type: "email_reply_sent",
      title: "Re: Smith v. Acme - Discovery",
      metadata: { from: "lawyer@firm.com", to: "legal@acme.com", threadId: "t1" },
    }),
    ev("email_reply_sent", 22, {
      source: "email",
      type: "email_reply_sent",
      title: "Re: Smith v. Acme - Discovery",
      metadata: { from: "lawyer@firm.com", to: "legal@acme.com", threadId: "t1" },
    }),
    ev("calendar_event", 45, {
      source: "calendar",
      type: "calendar_event",
      title: "Smith v. Acme - Deposition",
      timestampEnd: new Date(base.getTime() + 165 * 60 * 1000).toISOString(),
      metadata: { location: "Court Room 3" },
    }),
    ev("phone_call", 200, {
      source: "call",
      type: "phone_call",
      title: "Phone call: +1-555-0101",
      timestampEnd: new Date(base.getTime() + 215 * 60 * 1000).toISOString(),
      metadata: { phoneNumber: "+1-555-0101", durationSeconds: 900 },
    }),
    ev("travel", 240, {
      source: "location",
      type: "travel",
      title: "Travel to client site",
      timestampEnd: new Date(base.getTime() + 270 * 60 * 1000).toISOString(),
      metadata: { destinationType: "client_site", location: "Jones residence" },
    }),
    ev("document_open", 285, {
      source: "document",
      type: "document_open",
      title: "Jones_Will_Draft_v2.pdf",
      metadata: { documentType: "pdf" },
    }),
    ev("email_reply_sent", 300, {
      source: "email",
      type: "email_reply_sent",
      title: "Re: Jones Estate - Will review",
      metadata: { from: "lawyer@firm.com", to: "mary.jones@email.com" },
    }),
    ev("manual_entry", 330, {
      source: "manual",
      type: "manual_entry",
      title: "Research - Metro LLC precedent",
      timestampEnd: new Date(base.getTime() + 390 * 60 * 1000).toISOString(),
    }),
  ];

  demoStore.rawEvents = events;
  return events;
}

function seedSettings(): UserSettings {
  const settings: UserSettings = {
    userId,
    roundCallsToTenth: true,
    defaultReplyTenths: 0.1,
    defaultTravelBilling: 0.5,
    autoApproveCalendarEvents: false,
    timezone: "America/New_York",
  };
  demoStore.settings[userId] = settings;
  return settings;
}

function generateSuggestions(
  date: string,
  cases: Case[],
  contacts: Contact[],
  settings: UserSettings
): SuggestedEntry[] {
  const rawEvents = demoStore.rawEvents.filter((e) =>
    new Date(e.timestampStart).toISOString().startsWith(date)
  );

  const result = reconstructDay({
    rawEvents,
    cases,
    contacts,
    settings,
    date,
    userId,
  });

  demoStore.suggestedEntries = result.suggestedEntries;
  return result.suggestedEntries;
}

async function main() {
  const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);

  console.log("Seeding CaseClock demo data for", date);
  console.log("---");

  const cases = seedCases();
  console.log("Created", cases.length, "cases");

  const contacts = seedContacts(cases);
  console.log("Created", contacts.length, "contacts");

  const events = seedRawEvents(date);
  console.log("Created", events.length, "raw events");

  const settings = seedSettings();
  console.log("Created settings");

  const suggestions = generateSuggestions(date, cases, contacts, settings);
  console.log("Generated", suggestions.length, "suggested entries");
  console.log("---");
  console.log("Done. Start the dev server and visit /dashboard");
}

main().catch(console.error);
