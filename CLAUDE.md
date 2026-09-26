# FITLOG

Personal fitness tracker for Chris's cut (115.1 → 95 kg, started 12 Sep 2026). Single Express server (`server.js`, port 7779) + one-page frontend (`index.html`), SQLite via node-sqlite3-wasm (`fitness.db`, file-backed; safe to restart the server).

## Rules

- **Always use the HTTP API (`localhost:7779/api/...`), never sqlite3 CLI against the db file.** The running server holds it.
- FITLOG is the single source of truth for all fitness data. If any other surface disagrees, FITLOG wins.
- Never log warm-up sets, only working sets. Pain observations go in session notes as text.
- No em dashes anywhere (Chris's global rule), including generated HTML for Apple Notes.

## The Apple Notes workout log

Chris records lifts in an Apple Note, not the FITLOG UI. Live note: **"Post Cairo · Road to 95"**.

- AppleScript gotcha: `note "name"` can resolve to copies in **Recently Deleted**. Always resolve via `notes of folder "Notes" whose name is ...` and check the container before reading or writing.
- Format: editorial zine. H1 masthead, rotating epigraph quote (Georgia italic, self-contained), era dashboard (34px kg-to-go + 20-block mono progress bar, filled = (115.1 - latest)/(115.1 - 95)), then sessions **newest-first**, each: `■ SESSION No. NNN · TYPE` header (chip colored by day type: PUSH #F4A800, PULL #6B82FF, LEGS #2FBF8B, UPPER #B77DFF, RUN #FF6B4A), grey dateline (#B3AA95) with bodyweight, native table EXERCISE / KG (18px bold `<tt>`) / TARGET (mono) / REPS (Chris fills), one italic Focus line. No cue lists, no warm-up rows.
- Notes HTML laundering: `<tt>` → Courier monostyle blocks, tables survive, `<hr>`/blockquote/checklists get stripped, first body line becomes the note title. Read back the current body and match exact strings before targeted edits.

## Sync architecture

- **Workouts**: note → Claude (`/daily` command, `.claude/commands/daily.md`) → `POST /api/log`
- **Weight**: Withings scale → `POST /api/withings/sync` (direct Withings API; creds in `.withings-credentials.json`, gitignored)
- **Steps/sleep/runs/recovery**: Fitbit → Google Health API v4 → `POST /api/fitbit/sync` (Testing-mode Google Cloud project `fitlog`; refresh tokens expire weekly, re-consent at `/auth/google-health`). Syncs steps (FITBIT platform only, HEALTH_KIT points are iPhone duplicates; paginate via nextPageToken, counts are strings), sleep (unfiltered fetch, sleep type rejects server-side filters), auto-imports WALKING/RUNNING exercise sessions into `runs` (skip if manual run same day within 0.3km), and daily RHR + HRV into `daily_recovery` (`GET /api/recovery`). Readiness rules live in `.claude/commands/daily.md`. Never log walks/runs manually anymore.
- Diet: manual via `/api/diet` (MFP integration possible later)

## Goals page

Goal tiles are year-scoped (`/api/prs?since=` + client-side filters); all-time bests live in a separate strip. `bw_start` in goals = 115.1 (the cut's true start).
