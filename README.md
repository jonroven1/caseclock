# CaseClock

A lawyer time-tracking MVP that reconstructs billable time from captured events (email, calendar, calls, travel, documents) and suggests time entries in 0.1-hour increments.

## Tech Stack

- **Next.js** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Firebase Auth** (optional)
- **Firestore** (optional; in-memory demo store when not configured)

## Exact Run Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Start the development server

```bash
npm run dev
```

### 3. Open the app

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Load demo data

1. You will land on the **Dashboard**
2. Click **Load demo data**
3. Demo data for a plaintiff-side employment lawyer will be seeded (cases, contacts, events, suggestions)

### 5. Explore the app

- **Dashboard** – View suggested hours, approved hours, unreviewed count
- **Timeline** – See raw events for the day (mobile-optimized)
- **Suggestions** – Review, edit, merge, split, and approve time entries
- **Cases** – View matters (Henderson, Williams, Rodriguez)
- **Contacts** – View contacts linked to cases

## Production build

```bash
npm run build
npm start
```

## Seed via API (with server running)

```bash
curl -X POST 'http://localhost:3000/api/seed?date=2024-03-10'
```

Use today's date or any `YYYY-MM-DD` format.

## Setup (optional Firebase)

1. Copy `.env.example` to `.env.local`
2. Add your Firebase project credentials
3. Without Firebase, the app uses an in-memory demo store

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/       # Login page
│   ├── (app)/              # Dashboard, Timeline, Suggestions, Cases, Contacts, Settings
│   ├── api/
│   │   ├── events/         # Webhook ingestion (email, calendar, call, location, document)
│   │   ├── data/           # Data API (events, suggestions, cases, contacts, time-entries)
│   │   └── seed/           # Demo data seeding
│   └── page.tsx            # Redirects to /dashboard
├── components/
│   ├── layout/             # Nav, AppLayout
│   ├── suggestions/        # EditEntryModal, ConfidenceIndicator
│   └── ui/                 # Card, Badge, Button
├── lib/
├── services/
│   └── reconstruction-engine.ts
└── types/
```

## Features

- **Timeline** – Mobile-first vertical timeline with event type icons
- **Confidence indicator** – Case-matching confidence per suggested entry
- **Edit modal** – Case selector, description, duration (tenths), billable toggle
- **Merge** – Select multiple suggestions and merge into one
- **Split** – Split a suggestion into two entries
- **Dashboard summary** – Suggested hours, approved hours, unreviewed count

## Webhook Endpoints

| Endpoint | Payload |
|----------|---------|
| `/api/events/email` | `{ type, subject, from, to, threadId, timestamp }` |
| `/api/events/calendar` | `{ title, start, end, location, attendees }` |
| `/api/events/call` | `{ phoneNumber, durationSeconds, timestamp }` |
| `/api/events/location` | `{ type, location, destinationType, timestamp }` |
| `/api/events/document` | `{ documentName, timestamp }` |

## Connect Outlook (mobile)

1. Go to **Settings** → **Connect Outlook**
2. Tap **Connect Outlook** → sign in with your Microsoft account
3. Grant Mail.Read and Calendars.Read (read only)
4. Tap **Sync today** to pull calendar and email into CaseClock

**Setup:** Add `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` to `.env.local`. Register an app in [Azure Portal](https://portal.azure.com) → App registrations. Set redirect URI to `https://your-domain/api/auth/outlook/callback`. For local dev, use ngrok and set `NEXT_PUBLIC_APP_URL` to your ngrok URL.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.
