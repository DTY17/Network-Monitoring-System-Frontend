# Network Monitoring System — Syslog Monitoring Dashboard

A web dashboard for collecting, reviewing, and approving syslog events from network devices (e.g. Cisco switches/routers). Devices send syslog over UDP, a Python collector parses and forwards each message to the backend, and the React frontend lets users mark issues as fixed while admins approve or reject the fixes.

## Features

- **Syslog collector** — Python UDP listener on port 514 that parses Cisco-style syslog lines and posts them to the API
- **Role-based access** — `Admin` and `Member` roles with different capabilities
- **Approve queue (admin only)** — all `pending` events in one place, with one-click Approve / Reject
- **Syslog page** — browse all events, filter by status, open a detail view, mark as fixed
- **User management** — admins can invite, edit, change roles, and remove users; members get a read-only list
- **History** — audit log view with type filters

## Roles & Permissions

| Capability | Member | Admin |
|---|---|---|
| View syslog events | ✅ | ✅ |
| Mark an event as **Fixed** | ✅ | ✅ |
| Approve / reject fixed events (Syslog page) | ❌ | ✅ |
| Access **Approve** page (pending queue) | ❌ | ✅ |
| View users | ✅ (read-only) | ✅ |
| Invite / edit / remove users | ❌ | ✅ |

## Status Workflow

Each syslog event has a `status`:

```
pending ──(user marks fixed)──▶ fixed ──(admin approves)──▶ complete
   │                              │
   │                              └──(admin rejects)──▶ not_complete ──(user marks fixed again)──▶ fixed
   │
   └──(admin approves/rejects directly from the Approve page)──▶ complete / not_complete
```

| Status | Meaning |
|---|---|
| `pending` | New event, not yet handled |
| `fixed` | A user says it's resolved; awaiting admin approval |
| `complete` | Admin approved the fix |
| `not_complete` | Admin rejected; can be marked fixed again |

## Tech Stack

- **Frontend:** React + TypeScript (Vite), React Router, Tailwind CSS, Recharts, Axios
- **Backend:** Node.js / Express, MongoDB (Mongoose)
- **Collector:** Python 3 (UDP socket + `requests`)
- **Fonts:** Sora (UI) and IBM Plex Mono (data/log text) via Google Fonts

## Project Structure

```
src/
├── App.tsx                  # Routes: /login, /dashboard/*
├── main.tsx
├── auth/
│   └── auth.tsx             # Login page
├── dashboard/
│   └── dashboard.tsx        # Shell: sidebar, topbar, nested routes, admin route guard
├── components/
│   ├── approve.tsx          # Admin-only pending queue
│   ├── syslog.tsx           # Event list, detail modal, mark fixed / approve / reject
│   ├── user.tsx             # User CRUD (admin) / read-only list (member)
│   └── history.tsx          # Audit log
└── util/
    ├── axios.ts             # sendHTTP helper (BASE_URL = http://localhost:3000)
    └── auth.ts              # Role/session helpers (localStorage)
```

## Getting Started

### 1. Frontend

```bash
npm install
npm install recharts        # only needed if you re-add chart components
npm run dev
```

Add the fonts to the `<head>` of `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

The API base URL is set in `src/util/axios.ts`:

```ts
const BASE_URL = "http://localhost:3000";
```

### 2. Backend

Start the API on port `3000` (adjust `BASE_URL` if different) with MongoDB running. New syslog documents should default `status` to `"pending"`:

```ts
status: { type: String, default: "pending" }
```

### 3. Syslog Collector

```bash
python syslog_catch.py
```

Listens on `0.0.0.0:514/udp` and forwards parsed messages to `POST /api/v1/notification`. Binding to port 514 usually requires administrator/root privileges. Point your device at the collector's IP, for example on Cisco IOS:

```
logging host <collector-ip>
```

## Syslog Data Model

```ts
interface ISyslogMessage {
  priority?: number;
  timestamp?: string;
  facility?: string;
  severity?: number;     // 0 (Emergency) … 7 (Debug)
  msg_tag?: string;
  msg_text?: string;
  raw?: string;
  status: "pending" | "fixed" | "complete" | "not_complete";
}
```

Severity colors in the UI: 0–2 red/orange, 3–4 amber/yellow, 5 blue, 6 teal, 7 gray.

## API Endpoints

Used by the frontend. Endpoints marked **new** don't exist in the original backend and need to be implemented.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/user/login` | Login; response should include `data.role`, `data._id`, `data.name` |
| GET | `/api/v1/user/get` | List users |
| GET | `/api/v1/user/count` | User count |
| POST | `/api/v1/user/create` | Invite user — **new** |
| POST | `/api/v1/user/update/:id` | Edit user — **new** |
| POST | `/api/v1/user/delete/:id` | Remove user — **new** |
| GET | `/api/v1/notification/` | List syslog events |
| GET | `/api/v1/notification/count` | Syslog count |
| POST | `/api/v1/notification` | Collector ingests an event |
| POST | `/api/v1/notification/status/:id` | Body `{ status }` — update workflow status — **new** |

## Security Notes

⚠️ **Role checks in the frontend are for UX only.** The current role is stored in `localStorage` and can be edited by anyone with browser dev tools. The backend **must** enforce permissions independently:

- Only admins may call user create/update/delete
- Only admins may set `status` to `complete` or `not_complete`
- Non-admins may only set `status` to `fixed`
- Validate a session token or JWT on every request — don't trust a role sent by the client

Also: never return password hashes from `/api/v1/user/get`, and hash passwords (e.g. bcrypt) on create/update.

## Troubleshooting

**Collector prints `Send error: ... [WinError 10061] ... actively refused`**
The backend isn't running (or is on a different port). Start the API on port 3000 — events received while it was down are not retried and are lost.

**Fonts look generic**
The Google Fonts `<link>` tags aren't in `index.html`.

**Approve page shows "Admins only"**
The logged-in user's `role` in `localStorage` isn't `"Admin"`. Check the login response field names in `src/auth/auth.tsx` (`setSession` call).

**Timestamps look truncated (e.g. `Mar  1 00`)**
The collector's timestamp regex stops at the first colon. Adjust the parser in `syslog_catch.py` to capture the full `HH:MM:SS.mmm` portion.

## Roadmap Ideas

- Real authentication (JWT/session cookies) and server-side role enforcement
- Dashboard charts (events by severity/status) with recharts
- Real-time updates via WebSocket/SSE instead of fetch-on-load
- Pagination and search on the Syslog page
- Audit trail recording who changed each status and when
