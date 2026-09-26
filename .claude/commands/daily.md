# /daily - morning sync + brief for the Post Cairo cut

Run the daily sync loop. FITLOG (localhost:7779) is the single source of truth; the Apple Note "Post Cairo · Road to 95" is a rendered view; Fitbit feeds steps/weight/sleep. Always use the HTTP API, never sqlite directly.

## Steps

1. **Withings sync** (weight): `POST /api/withings/sync?days=3`. If 401, tell Chris to visit localhost:7779/auth/withings.
   **Fitbit sync** (steps/sleep via Google Health API): `POST /api/fitbit/sync?days=3`. On auth error: the Testing-mode refresh token has expired (weekly), tell Chris to re-consent at localhost:7779/auth/google-health (Advanced → continue past the unverified warning).

2. **Harvest the note**: read the Apple Note "Post Cairo · Road to 95" via AppleScript.
   - CRITICAL: `note "name"` can resolve to copies in Recently Deleted. Always resolve via `notes of folder "Notes" whose name is ...` or by known id, and verify the container is not Recently Deleted before reading or writing.
   - If any session table has filled REPS cells that aren't yet in FITLOG: log the session via `POST /api/log` (working sets only, exact exercise names from the note), then:
     - add a one-line Georgia-italic verdict under that session's table (what moved up, what repeats)
     - mark any PR (compare against `/api/prs`) with a PR stamp on the row
     - insert the NEXT session skeleton ABOVE it (newest first). Day type by ROTATION, not weekday: pick the least-recently-trained of Push/Pull/Legs from actual session history (`GET /api/sessions`), never schedule the same type within 48h, Upper can substitute when it is the freshest fit. The dashboard workout tile and week card also suggest by rotation now (`nextRotationType()` in index.html, REST suggested after 3 consecutive training days); the weekday ROUTINE map only fills future-day placeholders. Targets from last matching session (progress reps first, then weight); color chip per type: PUSH #F4A800, PULL #6B82FF, LEGS #2FBF8B, UPPER #B77DFF, RUN #FF6B4A. Table format: EXERCISE / KG (18px bold mono) / TARGET (mono) / REPS (empty). One italic Focus line, no cue lists. Last row of every skeleton is the cardio finisher: "Incline Walk" / target "8-12% · 6 km/h · 20-30 min · HR 125-140" (replaces the old "Walk/Run easy" row; running and rowing are parked, see memory).

3. **Weigh-in**: check `GET /api/body-weight` for today. If missing after the Fitbit sync, ask Chris for the scale number and `POST /api/body-weight`.

4. **Refresh the note masthead**: recompute from FITLOG: kg-to-go (latest weight - 95), progress bar (20 blocks, filled = (115.1 - latest) / (115.1 - 95)), dateline. Rotate the epigraph quote (sources: Notion Areas/Fitness Motivation + Memories sections, or an outside quote that fits the day; self-contained lines only, no em dashes anywhere).

5. **Readiness check** (from synced data, no wearable score needed):
   - Compute 7-day baselines for RHR and HRV from `GET /api/recovery`, and sleep from `GET /api/sleep`.
   - GREEN: RHR within ~2bpm of baseline, HRV at/above baseline, sleep >= 7h → train as planned, push the progression targets.
   - AMBER: RHR +3-5bpm OR sleep 5.5-7h OR HRV clearly below baseline → train but hold last session's weights, no new PRs, cut a set if grinding.
   - RED: RHR +5bpm or more, or sleep < 5.5h, or feeling ill → swap to walk + easy mobility; lifting at 115kg on no sleep is how backs go.
   - Sleep < 6h also predicts hunger: flag "cravings likely today, pre-plan meals, no ordering apps after 9pm" (his crepe pattern).
   - Waking up groggy does NOT downgrade a green day: that is sleep inertia (worst after 9h+ sleep), it lifts within an hour of being upright. Reassess feel 1-2h after waking, never from bed (14 Sep 2026: best metrics of the log, felt wrecked at 08:30, fine by mid-morning).

6. **Brief** (final message, keep it tight):
   - weight today + 7-day average trend vs last week
   - bar % and kg to go
   - yesterday's steps vs 10k goal (steps/runs now auto-sync from Fitbit; runs marked "Auto:" came from the watch)
   - last night's sleep + readiness verdict (green/amber/red) with the concrete training adjustment
   - today's planned session per routine + its color
   - any body-status flags (back, toe, hip) mentioned recently
   - one line: the single most useful action today

## Rules
- No em dashes anywhere, including inside the note HTML.
- FITLOG wins any conflict; repair the note to match.
- Don't log warm-up sets. Pain observations go in session notes as text.
