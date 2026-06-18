# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (Express + Vite HMR on port 3000)
npm run build      # Build frontend (Vite) + compile backend (esbuild → dist/server.cjs)
npm run start      # Run production build locally
npm run lint       # Type-check only (tsc --noEmit), no test suite exists
```

### Deploy to Cloud Run
```bash
gcloud run deploy classtalk-forum \
  --source . \
  --project roylanguageproject \
  --region asia-east1 \
  --allow-unauthenticated \
  --quiet
```
Env vars (`SUPABASE_URL`, `SUPABASE_KEY`, `COOLENG_SSO_SECRET`) are already set on the Cloud Run service — omit `--set-env-vars` on subsequent deploys or they will be overwritten.

### Scripts (Python, no dependencies)
```bash
# Clear all forum data from Supabase (replies → comments → topics → rooms)
python scripts/clear_db.py <SUPABASE_URL> <SUPABASE_KEY>

# End-to-end API + SSO test against production
$env:COOLENG_SSO_SECRET="<secret>"; python scripts/test_full_flow.py
```

## Architecture

Single-repo full-stack app: Express serves both the REST API and the React SPA.

```
Browser → Cloud Run (Express on :8080)
                ├── GET /auth/callback   → SSO validation, redirect to frontend
                ├── /api/*               → Express route handlers (server.ts)
                └── /*                   → Static dist/ (React SPA)
                          ↓
                    Supabase (PostgreSQL)
                    rutovjzabumczlrmrsys.supabase.co
```

### Build pipeline
- **Frontend**: Vite bundles `src/` → `dist/`
- **Backend**: esbuild bundles `server.ts` → `dist/server.cjs` with `--packages=external` (node_modules installed separately in Docker image)
- **Runtime**: `node dist/server.cjs` — Express serves `dist/index.html` for all non-API routes

> ⚠️ Node.js **22** required. Supabase realtime client needs native WebSocket (Node 22+). Dockerfile uses `node:22-alpine`.

## CoolEnglish SSO

All access requires SSO — unauthenticated users are auto-redirected to `https://www.coolenglish.edu.tw/ai/classtalk.php`.

**Flow**: CoolEnglish → `GET /auth/callback?p=<hex>&q=<sha256>` → server validates → `/?sso_uid=<id>&sso_name=<name>&sso_role=<role>` → frontend stores in `sessionStorage` (cleared on tab close) → URL params cleared via `history.replaceState`.

**Validation** (`server.ts` `GET /auth/callback`):
- `p` = hex-encoded `userid|姓名|role|timestamp|cool`
- `q` = SHA256(`p` + `COOLENG_SSO_SECRET`)
- Timestamp must be within ±300 seconds
- Role must be `"teacher"` or `"student"`

**Secret**: stored as `COOLENG_SSO_SECRET` env var on Cloud Run only — never in source code.

## Frontend (`src/`)

State is owned entirely by `App.tsx`: `currentView`, `room`, `userRole`, `userName`, `historyList`, `ssoUid`, `ssoName`, `ssoRole`. The three view components are stateless and receive callbacks.

- `HomeView` — teacher creates a room (POST `/api/rooms`); student joins by 6-char code. The 5-room cap for teachers is enforced client-side via localStorage history count.
- `RoomDashboard` — topic list; teacher can add/edit/delete topics and toggle `isOpen`. Refreshes via `onRefreshRoom` after mutations.
- `TopicDiscussion` — comment thread with nested replies. Polls every 4 seconds.

**SSO state init order** (in `App.tsx`):
1. `useState` initializers read from URL params first, then `sessionStorage`
2. A `useEffect` saves URL params to `sessionStorage` and clears them from the URL
3. If `ssoName` or `ssoRole` is missing, an auto-redirect `useEffect` fires immediately

**Per-user history**: localStorage key is `discussion_forum_history_<ssoUid>` (using the stable CoolEnglish userid, not the display name). This ensures history persists across logout/re-login.

**Role locking**: when `ssoRole` is set, the teacher/student tab switcher is hidden, name fields are `readOnly`, and students cannot access the room-creation section.

## Backend (`server.ts`)

One file — all Express routes + Supabase client. Key patterns:

- `fetchRoom(code)` — deep nested Supabase select (`rooms → topics → comments → replies`). All `GET /api/rooms/:code` calls go through this.
- `transformRoom(raw)` — maps snake_case DB fields to camelCase for the frontend; applies oldest-first sort.
- All entity IDs are client-generated via `Math.random().toString(36)`.
- Comments and replies are capped at 100 characters server-side.
- Students cannot comment/reply on closed topics (`is_open = false`).
- Topics are always created open; use `PUT` to toggle `isOpen`.

## Database schema

```
rooms       code PK, name, created_at
topics      id PK, room_code FK→rooms, title, description, is_open, created_at, updated_at
comments    id PK, topic_id FK→topics, author_name, author_role, content, created_at
replies     id PK, comment_id FK→comments, author_name, author_role, content, created_at
```

RLS is **disabled** on all four tables — access is controlled at the Express layer.

The Supabase project also contains unrelated tables (`essay_chats`, `essay_submissions`, `gept_results`, `ielts_results`, `profiles`, `question_logs`, `toefl_results`) — **do not touch these**.

## Pending work

- **Server-side role enforcement**: Any client can currently pass `authorRole: "teacher"` in API payloads. Will be fixed once SSO uid is verified server-side.
- **Room limit**: The 5-room cap per teacher is only enforced in localStorage; needs server-side enforcement tied to SSO uid.
