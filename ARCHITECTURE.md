# CaseClock Architecture Summary

## Overview

CaseClock is a lawyer time-tracking MVP that ingests activity events from external sources, reconstructs likely billable work blocks, and lets users approve/edit time entries in 0.1-hour increments.

## What Is Complete

- **Next.js app** with TypeScript, Tailwind, App Router
- **TypeScript types** for all Firestore collections (users, cases, contacts, raw_events, suggested_entries, time_entries, settings)
- **Firebase config** placeholders (client + optional admin)
- **Reconstruction engine** – modular service that:
  - Sorts raw events chronologically
  - Clusters email replies in same thread (15 min window)
  - Applies heuristics: email, calendar, call, travel, document, manual
  - Links events to cases via contact email/phone/calendar title
  - Deduplicates and outputs suggested entries
- **Webhook API routes** – POST endpoints for email, calendar, call, location, document
- **Data API routes** – GET events, suggestions, cases, contacts, time-entries; POST for approval
- **Seed API** – POST /api/seed loads demo data
- **Demo store** – in-memory store when Firebase is not configured
- **UI pages**:
  - Login (Firebase Auth)
  - Dashboard (summary, load demo)
  - Timeline (raw events by day)
  - Suggestions (approve/reject, assign case)
  - Cases and Contacts lists
  - Settings (heuristics, webhook info)
- **UI components** – Card, Badge, Button, Nav, AppLayout
- **Mobile-first layout** – responsive, bottom nav on mobile
- **README** and setup instructions

## What Is Mocked

- **Firebase Auth** – optional; app works without it (demo mode)
- **Firestore** – optional; uses in-memory demo store when not configured
- **User ID** – hardcoded `demo-user` for MVP
- **Webhook auth** – no auth on API routes (add in production)
- **Merge/split** – UI stubs for merge/split suggested entries (not implemented)
- **Edit suggested entry** – inline edit of duration/description (not implemented)

## Next 5 Best Improvements

1. **Firebase Auth integration** – Protect routes, use real user ID from token, add auth middleware to webhooks
2. **Firestore persistence** – Wire full CRUD to Firestore when configured; persist seed data
3. **Merge/split suggestions** – Implement merge (combine two suggestions) and split (divide one into two)
4. **Inline edit** – Edit suggested entry duration and description before approving
5. **Real-time sync** – Firestore listeners or polling for live updates across tabs
