# FITLOG

Single-user fitness tracker for a cut. Single Express server (`server.js`, port 7779) + one-page frontend (`index.html`), SQLite via node-sqlite3-wasm (`fitness.db`, file-backed; safe to restart the server). See `README.md` for setup.

Nothing personal lives in the source: the profile (start and goal weight, cut start, height, birth date, step/sleep targets, plan kg per week) is in the `goals` key/value table and edited in the app. The training split is `PROGRAMS` and `ROUTINE` in `index.html`, meant to be edited per person.

If `GET /api/goals` comes back empty or without `bw_start`, this is a fresh install:
offer to run `/setup` (`.claude/commands/setup.md`), which walks the user through the
profile conversationally, rather than asking them to edit anything by hand.

Sections marked **[personal]** describe Chris's own setup and are not part of the shared project. Anyone else forking this can ignore them; the UI rules and code conventions below apply to everyone.

## Rules

- **Always use the HTTP API (`localhost:7779/api/...`), never sqlite3 CLI against the db file.** The running server holds it.
- FITLOG is the single source of truth for all fitness data. If any other surface disagrees, FITLOG wins.
- Never log warm-up sets, only working sets. Pain observations go in session notes as text.
- No em dashes anywhere, including generated HTML for Apple Notes.

## The Apple Notes workout log [personal]

Chris records lifts in an Apple Note, not the FITLOG UI. The app has a full in-app session logger; this is one person's alternative to it. Live note: **"The Last Cut"** (renamed from "Post Cairo · Road to 95" on 3 Oct 2026; the era is about ending the weight yoyo, not about Cairo).

- AppleScript gotcha: `note "name"` can resolve to copies in **Recently Deleted**. Always resolve via `notes of folder "Notes" whose name is ...` and check the container before reading or writing.
- Format: editorial zine. H1 masthead, rotating epigraph quote (Georgia italic, self-contained), era dashboard (34px kg-to-go + 20-block mono progress bar, filled = (115.1 - latest)/(115.1 - 95)), then sessions **newest-first**, each: `■ SESSION No. NNN · TYPE` header (chip colored by day type: PUSH #F4A800, PULL #6B82FF, LEGS #2FBF8B, UPPER #9b5de5, RUN #FF6B4A), grey dateline (#B3AA95) with bodyweight, native table EXERCISE / KG (18px bold `<tt>`) / TARGET (mono) / REPS (Chris fills), one italic Focus line. No cue lists, no warm-up rows.
- Notes HTML laundering: `<tt>` → Courier monostyle blocks, tables survive, `<hr>`/blockquote/checklists get stripped, first body line becomes the note title. Read back the current body and match exact strings before targeted edits.

## Sync architecture

- **Workouts**: in-app logger → `POST /api/log`. [personal] Chris instead goes note → Claude (`/cut` command, `.claude/commands/cut.md`) → `POST /api/log`.
- **Weight**: Withings scale → `POST /api/withings/sync` (direct Withings API; creds in `.withings-credentials.json`, gitignored)
- **Steps/sleep/runs/recovery**: Fitbit → Google Health API v4 → `POST /api/fitbit/sync` (Testing-mode Google Cloud project `fitlog`; refresh tokens expire weekly, re-consent at `/auth/google-health`). Syncs steps (FITBIT platform only, HEALTH_KIT points are iPhone duplicates; paginate via nextPageToken, counts are strings), sleep (unfiltered fetch, sleep type rejects server-side filters), auto-imports WALKING/RUNNING exercise sessions into `runs` (skip if manual run same day within 0.3km), and daily RHR + HRV into `daily_recovery` (`GET /api/recovery`). Readiness rules live in `.claude/commands/cut.md`. Never log walks/runs manually anymore.
- Diet: manual via `/api/diet` (MFP integration possible later)
- **Sync status**: `GET /api/fitbit/status` and `GET /api/withings/status` both return `{ connected, ok, last_sync, stale_hours, last_error, reconnect_url }`. `ok` is false once a sync errors or goes more than 30h stale, which is what turns the header chip red.
- **Runs vs walks**: `runs.kind` is `'run'` or `'walk'`, set on Fitbit import and backfilled by pace (slower than 9:00/km is a walk). Walks are excluded from run stats, run cards and the running goal tiles.
- **Dates**: the server writes local Dubai dates (`todayIso()`), never `toISOString()`, which is the wrong day before 04:00.

## UI rules (frontend)

These are the rules `index.html` follows. Keep to them when editing it.

- **Fonts:** Big Shoulders Display 900 for every display number and title. Archivo 500-800 for UI. Newsreader italic only for "Your why". No Anton.
- **Sizes:** labels 11-12px uppercase, letter-spacing 0.12-0.16em. Nothing under 10px, chart labels included. Body 13-16px.
- **Borders:** 3px `#1a1610` for containers, cards, modals and the header. 2px for controls (buttons, inputs, chips). No 4px, 1.5px or 1px borders.
- **Ink and paper:** paper `#efe9da`, card `#f7f1e3`, ink `#1a1610`, muted text `#6b6555` (never `#8a8270` for text).
- **Colour meanings, one each:**
  - red `#e5431e`: the cut (bodyweight), the main action, and a PR
  - program colours: PUSH `#f4a800`, PULL `#2e44c8`, LEGS `#1e8a63`, UPPER `#9b5de5`. The app uses this map everywhere; the Apple Notes spec above still carries its own PULL and LEGS values and has only been aligned on UPPER.
  - readiness: GREEN `#1e8a63`, AMBER `#b87d00`, RED `#e5431e`
- **Text on colour:** ink on gold, paper on red, blue, green, purple and ink. Never gold or green text on red.
- **Modals:** one shell. 3px border, `10px 10px 0 #1a1610` shadow, header with title, subtitle and a ✕. Footer with a ghost button (flex 1) and an ink primary (flex 2).
- **Pillars:** a pending pillar is a card with an ink action button. A done pillar is filled with its colour and has a "✓ DONE" tag.
- **Code:**
  - One `localIso()` for dates, never `toISOString()`.
  - One `dayScore()`, one `TYPE_COLOR` map, one `projection()`.
  - Chart domains come from the data, not constants.
  - Walks (pace slower than 9:00/km) are not runs.
  - No inline `onclick` and no imperative `element.style.*`: one delegated listener reads `data-act`, and colours ride on CSS custom properties.

## Today screen modes

`deriveMode()` reads the clock and the data, never a user setting:

- **Not weighed:** no body-weight row dated today. The hero shows NOT WEIGHED TODAY and inverts the log button.
- **Evening:** local time >= 18:00 and the day score is exactly 3. The hero is replaced by an ink card naming the missing pillar, and every other tab gets a gold streak-at-risk banner.
- **Monday:** the score card becomes last week's recap.
- **RED / weigh-in bump:** readiness RED, or a weigh-in up >= 0.5 kg on the previous one, shows the "Your why" card instead of the score card.

## Goals page

Goal tiles are year-scoped (`/api/prs?since=` + client-side filters); all-time bests live in a separate strip. `bw_start` in goals is the cut's true start weight, not the first weigh-in of the year.
