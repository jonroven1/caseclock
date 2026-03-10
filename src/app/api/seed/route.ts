/**
 * POST /api/seed?date=YYYY-MM-DD
 * Seeds demo data for a plaintiff-side employment lawyer
 */

import { NextRequest, NextResponse } from "next/server";
import { demoStore } from "@/lib/demo-store";
import { reconstructDay } from "@/services/reconstruction-engine";
import type {
  RawEvent,
  Case,
  Contact,
  UserSettings,
} from "@/types";

const userId = "demo-user";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function seedCases(): Case[] {
  const cases: Case[] = [
    {
      id: "case_henderson_termination",
      userId,
      caseName: "Henderson v. TechStart Inc.",
      matterNumber: "2024-101",
      clientName: "Maria Henderson",
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "case_williams_wage",
      userId,
      caseName: "Williams et al. v. Metro Foods",
      matterNumber: "2024-102",
      clientName: "James Williams",
      status: "active",
      createdAt: new Date().toISOString(),
    },
    {
      id: "case_rodriguez_discrimination",
      userId,
      caseName: "Rodriguez v. Global Retail Corp",
      matterNumber: "2024-103",
      clientName: "Carlos Rodriguez",
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
      name: "Maria Henderson",
      email: "maria.henderson@email.com",
      phone: "+1-555-0201",
      role: "Client",
    },
    {
      id: generateId("contact"),
      userId,
      caseId: cases[0].id,
      name: "TechStart Legal",
      email: "legal@techstart.com",
      role: "Defense counsel",
    },
    {
      id: generateId("contact"),
      userId,
      caseId: cases[1].id,
      name: "James Williams",
      email: "j.williams@email.com",
      phone: "+1-555-0202",
      role: "Client",
    },
    {
      id: generateId("contact"),
      userId,
      caseId: cases[2].id,
      name: "Carlos Rodriguez",
      email: "c.rodriguez@email.com",
      role: "Client",
    },
    {
      id: generateId("contact"),
      userId,
      caseId: cases[2].id,
      name: "EEOC Investigator",
      email: "investigator@eeoc.gov",
      role: "Agency",
    },
  ];
  demoStore.contacts = contacts;
  return contacts;
}

function seedRawEvents(date: string): RawEvent[] {
  const base = new Date(`${date}T08:30:00`);
  const ev = (
    type: RawEvent["type"],
    offsetMin: number,
    opts: Partial<RawEvent> = {}
  ) => {
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
      title: "Re: Henderson - Discovery responses due",
      metadata: { from: "legal@techstart.com", to: "lawyer@firm.com" },
    }),
    ev("email_reply_sent", 18, {
      source: "email",
      type: "email_reply_sent",
      title: "Re: Henderson - Discovery responses",
      metadata: {
        from: "lawyer@firm.com",
        to: "legal@techstart.com",
        threadId: "t1",
      },
    }),
    ev("email_reply_sent", 25, {
      source: "email",
      type: "email_reply_sent",
      title: "Re: Henderson - Discovery responses",
      metadata: {
        from: "lawyer@firm.com",
        to: "legal@techstart.com",
        threadId: "t1",
      },
    }),
    ev("calendar_event", 45, {
      source: "calendar",
      type: "calendar_event",
      title: "Henderson v. TechStart - Deposition of HR Director",
      timestampEnd: new Date(base.getTime() + 195 * 60 * 1000).toISOString(),
      metadata: { location: "Court Reporter Office, Suite 400" },
    }),
    ev("phone_call", 220, {
      source: "call",
      type: "phone_call",
      title: "Phone call: +1-555-0202",
      timestampEnd: new Date(base.getTime() + 235 * 60 * 1000).toISOString(),
      metadata: { phoneNumber: "+1-555-0202", durationSeconds: 900 },
    }),
    ev("travel", 250, {
      source: "location",
      type: "travel",
      title: "Travel to court",
      timestampEnd: new Date(base.getTime() + 280 * 60 * 1000).toISOString(),
      metadata: {
        destinationType: "court",
        location: "Superior Court, Dept. 12",
      },
    }),
    ev("calendar_event", 285, {
      source: "calendar",
      type: "calendar_event",
      title: "Rodriguez - Case management conference",
      timestampEnd: new Date(base.getTime() + 315 * 60 * 1000).toISOString(),
      metadata: { location: "Superior Court, Dept. 12" },
    }),
    ev("document_open", 330, {
      source: "document",
      type: "document_open",
      title: "Williams_Complaint_Amended_v3.pdf",
      metadata: { documentType: "pdf" },
    }),
    ev("email_reply_sent", 360, {
      source: "email",
      type: "email_reply_sent",
      title: "Re: Williams - Wage claim interrogatories",
      metadata: { from: "lawyer@firm.com", to: "defense@metrofoods.com" },
    }),
    ev("manual_entry", 390, {
      source: "manual",
      type: "manual_entry",
      title: "Research - Retaliation standard under FEHA",
      timestampEnd: new Date(base.getTime() + 450 * 60 * 1000).toISOString(),
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
    timezone: "America/Los_Angeles",
  };
  demoStore.settings[userId] = settings;
  return settings;
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const cases = seedCases();
  const contacts = seedContacts(cases);
  seedRawEvents(date);
  const settings = seedSettings();

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

  return NextResponse.json({
    success: true,
    date,
    cases: cases.length,
    contacts: contacts.length,
    events: rawEvents.length,
    suggestions: result.suggestedEntries.length,
  });
}
