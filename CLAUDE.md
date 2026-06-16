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
  --set-env-vars "SUPABASE_URL=...,SUPABASE_KEY=..." \
  --quiet
```

## Architecture

This is a **single-repo full-stack app**: Express serves both the REST API and the React SPA.

```
Browser → Cloud Run (Express on :8080)
                ├── /api/*        → Express route handlers (server.ts)
                └── /*            → Static dist/ (React SPA)
                          ↓
                    Supabase (PostgreSQL)
                    rutovjzabumczlrmrsys.supabase.co
```

### Build pipeline
- **Frontend**: Vite bundles `src/` → `dist/` (standard SPA output)
- **Backend**: esbuild bundles `server.ts` → `dist/server.cjs` with `--packages=external` (node_modules are NOT inlined; they're installed separately in the Docker image)
- **Runtime**: `node dist/server.cjs` — in production, Express serves `dist/index.html` for all non-API routes

> ⚠️ Node.js **22** is required (not 20). Supabase's realtime client requires native WebSocket, which only exists in Node 22+. The Dockerfile uses `node:22-alpine`.

### Frontend (`src/`)
State lives entirely in `App.tsx` — it owns `currentView`, `room`, `userRole`, `userName`, and `historyList`. The three views are stateless components that receive callbacks:

- `HomeView` — tab-switched form: teacher creates a room (POST `/api/rooms`), student joins by 6-char code (GET `/api/rooms/:code`). Teacher room limit (5) is enforced via `localStorage` history count, **not** server-side.
- `RoomDashboard` — topic list; teacher can add/edit/delete topics and toggle `isOpen`. Polls via `onRefreshRoom` after mutations.
- `TopicDiscussion` — comment thread with nested replies. Polls every 4 seconds via `setInterval`.

Session state (role, userName, roomCode) is stored in `localStorage` as `discussion_forum_history` (array of `HistoryItem`). There is **no authentication** — role is self-declared and passed as `authorRole` in API payloads; the server trusts it.

### Backend (`server.ts`)
One file — all Express routes + Supabase client. Key patterns:

- `fetchRoom(code)` — the only function that does a deep nested Supabase select (`rooms → topics → comments → replies`). All GET `/api/rooms/:code` calls go through this.
- `transformRoom(raw)` — maps Supabase snake_case (`is_open`, `author_name`, `created_at`) back to camelCase (`isOpen`, `authorName`, `createdAt`) that the frontend expects. Sort order (oldest-first) is applied here.
- All IDs are client-generated random strings (`Math.random().toString(36)`), not Supabase auto-increments.

### Database schema (Supabase / PostgreSQL)
```
rooms       code PK, name, created_at
topics      id PK, room_code FK→rooms, title, description, is_open, created_at, updated_at
comments    id PK, topic_id FK→topics, author_name, author_role, content, created_at
replies     id PK, comment_id FK→comments, author_name, author_role, content, created_at
```
RLS is **disabled** on all four tables (intentional — access is controlled at the Express layer, not DB layer).

The Supabase project also contains unrelated tables (`essay_chats`, `essay_submissions`, `gept_results`, `ielts_results`, `profiles`, `question_logs`, `toefl_results`) — **do not touch these**.

## Pending work

- **CoolEnglish SSO**: Awaiting API spec from CoolEnglish's student database team. The integration will use URL signing: `uid + ts + cs` where `cs = md5(uid + KEYWORD + ts)`. Keyword is self-defined and shared with CoolEnglish's Moodle side.
- **Server-side role enforcement**: Currently any client can pass `authorRole: "teacher"` to delete/manage content. This will be fixed once SSO is implemented.
- **Room limit**: The 5-room cap per teacher is only enforced in `localStorage`; needs server-side enforcement post-SSO.
