/**
 * Tests for email billing heuristics
 */

import {
  hasAttachment,
  followsDocumentOpen,
  getEventsBetween,
  hasInterveningEvents,
  findCorrespondingReceived,
  matchEmailToCase,
  clusterRepliesByThread,
  getSingleReplyTenths,
  getSingleReplyConfidence,
  getClusterTenths,
  DEFAULT_REPLY_TENTHS,
} from "../email-billing-heuristics";
import type { RawEvent, Case, Contact } from "@/types";

function makeEvent(
  overrides: Partial<RawEvent> & { type: RawEvent["type"] }
): RawEvent {
  return {
    id: "e1",
    userId: "u1",
    source: "email",
    type: overrides.type,
    title: "",
    timestampStart: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("hasAttachment", () => {
  it("returns true when attachmentCount > 0", () => {
    expect(
      hasAttachment(makeEvent({ type: "email_reply_sent", metadata: { attachmentCount: 1 } }))
    ).toBe(true);
  });
  it("returns true when hasAttachment is true", () => {
    expect(
      hasAttachment(makeEvent({ type: "email_reply_sent", metadata: { hasAttachment: true } }))
    ).toBe(true);
  });
  it("returns false when no attachment metadata", () => {
    expect(hasAttachment(makeEvent({ type: "email_reply_sent" }))).toBe(false);
  });
});

describe("followsDocumentOpen", () => {
  it("returns true when document_open precedes reply within window", () => {
    const base = new Date("2024-03-10T10:00:00");
    const doc = makeEvent({
      type: "document_open",
      id: "doc1",
      timestampStart: new Date(base.getTime() - 5 * 60 * 1000).toISOString(),
    });
    const reply = makeEvent({
      type: "email_reply_sent",
      id: "r1",
      timestampStart: base.toISOString(),
    });
    expect(followsDocumentOpen(reply, [doc])).toBe(true);
  });
  it("returns false when document_open is outside window", () => {
    const base = new Date("2024-03-10T10:00:00");
    const doc = makeEvent({
      type: "document_open",
      id: "doc1",
      timestampStart: new Date(base.getTime() - 20 * 60 * 1000).toISOString(),
    });
    const reply = makeEvent({
      type: "email_reply_sent",
      id: "r1",
      timestampStart: base.toISOString(),
    });
    expect(followsDocumentOpen(reply, [doc], 15)).toBe(false);
  });
});

describe("getEventsBetween", () => {
  it("returns events between received and reply", () => {
    const received = makeEvent({
      type: "email_received",
      id: "rec",
      timestampStart: "2024-03-10T09:00:00Z",
    });
    const reply = makeEvent({
      type: "email_reply_sent",
      id: "rep",
      timestampStart: "2024-03-10T09:30:00Z",
    });
    const between = makeEvent({
      type: "phone_call",
      id: "call",
      timestampStart: "2024-03-10T09:15:00Z",
    });
    expect(getEventsBetween(received, reply, [received, between, reply])).toEqual([between]);
  });
});

describe("hasInterveningEvents", () => {
  it("returns true when events exist between", () => {
    const received = makeEvent({
      type: "email_received",
      id: "rec",
      timestampStart: "2024-03-10T09:00:00Z",
    });
    const reply = makeEvent({
      type: "email_reply_sent",
      id: "rep",
      timestampStart: "2024-03-10T09:30:00Z",
    });
    const between = makeEvent({
      type: "phone_call",
      id: "call",
      timestampStart: "2024-03-10T09:15:00Z",
    });
    expect(hasInterveningEvents(received, reply, [received, between, reply])).toBe(true);
  });
  it("returns false when no events between", () => {
    const received = makeEvent({
      type: "email_received",
      id: "rec",
      timestampStart: "2024-03-10T09:00:00Z",
    });
    const reply = makeEvent({
      type: "email_reply_sent",
      id: "rep",
      timestampStart: "2024-03-10T09:30:00Z",
    });
    expect(hasInterveningEvents(received, reply, [received, reply])).toBe(false);
  });
});

describe("matchEmailToCase", () => {
  const cases: Case[] = [
    {
      id: "c1",
      userId: "u1",
      caseName: "Smith v. Acme",
      matterNumber: "001",
      clientName: "John Smith",
      status: "active",
      createdAt: "",
    },
  ];
  const contacts: Contact[] = [
    { id: "co1", userId: "u1", caseId: "c1", name: "John", email: "john@acme.com" },
  ];

  it("matches by contact email in metadata.from", () => {
    const event = makeEvent({
      type: "email_reply_sent",
      metadata: { from: "john@acme.com" },
    });
    expect(matchEmailToCase(event, cases, contacts)).toBe("c1");
  });
  it("matches by case name in subject/title", () => {
    const event = makeEvent({
      type: "email_reply_sent",
      title: "Re: Smith v. Acme - Discovery",
    });
    expect(matchEmailToCase(event, cases, contacts)).toBe("c1");
  });
  it("returns undefined when no match", () => {
    const event = makeEvent({
      type: "email_reply_sent",
      title: "Unrelated",
      metadata: { from: "unknown@x.com" },
    });
    expect(matchEmailToCase(event, cases, contacts)).toBeUndefined();
  });
});

describe("clusterRepliesByThread", () => {
  it("clusters replies within 30 min window", () => {
    const base = new Date("2024-03-10T10:00:00");
    const replies: RawEvent[] = [
      makeEvent({
        type: "email_reply_sent",
        id: "r1",
        timestampStart: base.toISOString(),
        metadata: { threadId: "t1" },
      }),
      makeEvent({
        type: "email_reply_sent",
        id: "r2",
        timestampStart: new Date(base.getTime() + 10 * 60 * 1000).toISOString(),
        metadata: { threadId: "t1" },
      }),
    ];
    const clusters = clusterRepliesByThread(replies, 30);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(2);
  });
  it("splits when gap exceeds window", () => {
    const base = new Date("2024-03-10T10:00:00");
    const replies: RawEvent[] = [
      makeEvent({
        type: "email_reply_sent",
        id: "r1",
        timestampStart: base.toISOString(),
      }),
      makeEvent({
        type: "email_reply_sent",
        id: "r2",
        timestampStart: new Date(base.getTime() + 45 * 60 * 1000).toISOString(),
      }),
    ];
    const clusters = clusterRepliesByThread(replies, 30);
    expect(clusters).toHaveLength(2);
  });
});

describe("getSingleReplyTenths", () => {
  it("returns default 0.1 for plain reply", () => {
    const reply = makeEvent({ type: "email_reply_sent" });
    expect(getSingleReplyTenths(reply, [])).toBe(DEFAULT_REPLY_TENTHS);
  });
  it("returns higher tenths when attachment present", () => {
    const reply = makeEvent({
      type: "email_reply_sent",
      metadata: { hasAttachment: true },
    });
    expect(getSingleReplyTenths(reply, [])).toBeGreaterThan(DEFAULT_REPLY_TENTHS);
  });
});

describe("getClusterTenths", () => {
  it("returns 0.2 for 2 replies", () => {
    const cluster = [
      makeEvent({ type: "email_reply_sent", id: "r1" }),
      makeEvent({ type: "email_reply_sent", id: "r2" }),
    ];
    expect(getClusterTenths(cluster)).toBe(0.2);
  });
  it("returns 0.3 for 3 replies", () => {
    const cluster = [
      makeEvent({ type: "email_reply_sent", id: "r1" }),
      makeEvent({ type: "email_reply_sent", id: "r2" }),
      makeEvent({ type: "email_reply_sent", id: "r3" }),
    ];
    expect(getClusterTenths(cluster)).toBe(0.3);
  });
});
