# Handoff: FITLOG — Personal Fitness Tracker

## Overview
FITLOG is a personal fitness tracking app for a single user cutting from 108 kg to 95 kg. It tracks bodyweight (the headline goal), strength training via repeatable programs, running (chasing a sub-30:00 5K), daily steps (10K goal), and calorie deficit. The design's core purpose is **motivation**: huge type, bold color blocks, a finish-line progress metaphor, PR celebration, and streaks.

Two deliverables:
- **Desktop web app** (`FITLOG Bold.dc.html`) — three screens (Dashboard, Training, Goals) + two modals (Log Weight, Log Session) + an exercise-detail drawer
- **Mobile app** (`FITLOG Mobile.dc.html`) — same feature set in a phone layout with bottom tab nav, FAB, and slide-up sheets

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established patterns and libraries — or, if no environment exists yet, choose the most appropriate framework and implement the designs there.

The `.dc.html` files contain a `<x-dc>` template (HTML with `{{ }}` binding holes) plus a `Component` logic class (plain React-style class) inside a `<script type="text/x-dc">` tag at the bottom. All state, data shapes, and handlers are in that class — it is the best reference for intended behavior. `support.js` is prototype runtime only; ignore it.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions are final design intent. Recreate pixel-perfectly using the codebase's component patterns. All data shown is sample data; the app should run on the user's real data with local persistence (the prototype intentionally resets on reload).

## Design Tokens

### Colors
- `#efe9da` — app background (warm paper)
- `#f7f1e3` — card background / light text on dark
- `#1a1610` — ink (near-black): text, borders, dark blocks
- `#2e44c8` — cobalt: hero blocks, PULL program, FAB
- `#f4a800` — amber/gold: progress fills, PUSH program, streak dot, WK badge
- `#e5431e` — red-orange: PR badges, primary CTA, MAX chip, RUN, active-tab underline
- `#1e8a63` — green: LEGS program, running/deficit tiles
- `#8a8270` — muted label brown-grey
- `#6b6555` / `#5c554a` — secondary body text
- `#a39a86` / `#b3aa95` — faint labels, dotted underlines
- `#ece4d2` — hairline dividers inside cards
- `#cfc7b4` / `#4a443a` — sheet grab-handle (light/dark)
- Scrim: `rgba(26,22,16,0.55–0.62)`

### Typography
- **Big Shoulders Display** (Google Fonts), weights 800–900 — all display numbers, headings, session names, wordmark. Tight line-height 0.7–0.85.
- **Archivo** (Google Fonts), weights 400–800 — labels, body, buttons, chips. Labels are uppercase with letter-spacing 0.06em–0.34em.
- Scale (desktop): hero number 172px → section titles 54px → tile numbers 58px → card titles 30px → labels 10–13px. Mobile: hero 92px, tiles 42px, titles 38px.

### Shape & borders
- Desktop: sharp corners (0 radius) on cards/blocks; 3px solid `#1a1610` borders; pills use border-radius 30px; modals have `border: 4px solid #1a1610` with hard offset shadow `14px 14px 0 rgba(26,22,16,0.25)`.
- Mobile: rounded (12–18px card radius, 46px phone bezel); 2–2.5px borders; sheets have 24px top radius + 4px top border.
- Progress bars: track = translucent fill of the surface's opposite color; fill uses the block's accent. Hero bar fill is a diagonal candy-stripe: `repeating-linear-gradient(135deg, #f4a800 0 11px, #e09600 11px 22px)`.

### Motion
- `popUp`: translateY(16px) → 0, 0.4–0.5s ease-out, staggered 0.05s per tile
- `barGrow`: scaleX(0) → 1, transform-origin left, ~1.1s cubic-bezier(.2,.8,.2,1)
- Sheets: slide up translateY(100%) → 0, 0.3s cubic-bezier(.2,.8,.2,1); scrim fades in 0.2s
- Never animate opacity from 0 on content containers (export/paint safety)

## Screens / Views

### 1. Dashboard (desktop)
- **Header** (all screens): bottom-bordered 3px ink. Left: FITLOG wordmark (Big Shoulders 900, 32px) over "ATHLETIC LOG" letterspaced micro-label. Center: three uppercase nav tabs (Archivo 700 13px), active = ink text + 3px `#e5431e` underline, inactive = `#a39a86`. Right: date label, black streak pill ("11-DAY STREAK" with amber dot), and a circular **WK 26** badge (amber, 3px ink border, 50px).
- **Hero (cobalt block)**: full-width `#2e44c8`, cream text, padding 34/38px. Giant ghost "95" (420px, 6% white) top-right. Label "BODYWEIGHT — THE CUT · 108 → 95 KG". Weight number 172px next to "−6.8 KG / since March" in amber. Right: 128px amber circle medallion with "52% / TO 95.0".
  - **Finish-line progress bar**: 16px track (20% cream), candy-stripe amber fill at progress %, milestone ticks at 105 kg (23.08%) and 100 kg (61.54%) with labels below, a cream dot marker at current % with the weight above it, "108 START" left and "95.0 FINISH ⚑" right (amber).
  - Below: "6.2 KG TO GO" (amber, 24px) + "— on pace for Sep 12 at −0.7 kg / week", and a **+ LOG WEIGHT** ghost pill button (2px 50%-cream border).
  - All hero numbers (weight, kg lost/to go, %, marker position) are **computed from one weight value**: `pct = (108 − w) / (108 − 95) × 100`.
- **Stat tiles** (4-col grid, 14px gap): STEPS (amber/ink), DEFICIT (red/cream), 5K BEST (ink/cream, amber label), RUNNING (green/cream). Each: micro-label, 58px number, sub-label. Values: 8,420 / −770 / 31:40 / 41.2 km.
- **Strength strip**: 3px ink outline (transparent bg). "STRENGTH · THIS WEEK" + 14,250 KG + "4 sessions" left; right: three PR pills (2px ink border, radius 30px) — BENCH 82.5, SQUAT 120, DEADLIFT 150 (numbers in red).

### 2. Training (desktop)
- Title "TRAINING LOG" (54px) + meta line; right-aligned **+ LOG SESSION** button (red, cream text, no radius).
- **Session cards** (list, rendered from state): 3px ink border, cream-white bg, 10px color spine on left (program color). Header row: session name (30px) + date chip + "58 MIN · 4,820 KG" meta. Body: 2-col grid of exercise rows — **exercise name is a button** (dotted underline `#b3aa95`) opening the exercise drawer; right side shows detail string ("82.5 ×5,5,4") + red **PR** badge when applicable. Optional **NOTE** footer row (italic, above a 2px `#ece4d2` divider).
- **Running section**: "RUNNING / THE SUB-30 CHASE · BEST 31:40" header; 3 cards — PR card is inverted (ink bg, amber time), others cream with ink times; each shows date, time (46px), distance · pace.

### 3. Goals (desktop)
- Title "GOALS" + "5 ACTIVE TARGETS · THE CUT IS THE HEADLINE".
- **Featured card** (cobalt, full width): BODYWEIGHT · THE CUT, weight 80px + "→ 95.0 kg", 52% (amber, right), 14px amber progress bar, summary line. Reads from the same computed weight state as Dashboard.
- **2×2 grid**: 5K RUN TIME (red, 72%), DAILY STEPS (amber, 84%), BENCH PRESS (ink, amber accents, 63%), CALORIE DEFICIT (green, 93%). Each: label + % top row, big value + target, progress bar, footnote.

### 4. Log Weight modal (desktop)
Centered dialog (420px, 4px ink border, hard shadow) over scrim. Title "LOG TODAY'S WEIGHT", subtitle "THE CUT · 108 → 95 KG". Number input (Big Shoulders 900 42px, 2px ink border) + "KG". Buttons: CANCEL (ghost) / SAVE WEIGHT (cobalt). Saving updates all weight-derived UI. Clicking scrim or ✕ closes.

### 5. Log Session modal — two phases (desktop)
Centered dialog (560px, max-height 90vh, scrollable). Header: dynamic title/subtitle + circular ✕.
- **Phase 1 — PICK**: subtitle "PICK A PROGRAM TO BEGIN". Three full-width program cards (3px ink border, color spine, name 30px, "4 EXERCISES →"). Selecting a program pre-fills phase 2 with its prescription (last session's sets).
- **Phase 2 — LOG**: subtitle "ENTER YOUR SETS · TODAY · 25 JUN". One card per exercise: header with name + **LAST** chip (paper bg pill, e.g. "LAST 82.5 ×5,5,4") + **MAX** chip (red pill, e.g. "MAX 82.5 kg"); body rows "SET n | [weight] kg × [reps] reps" (number inputs, Big Shoulders 900 18px, centered). Below cards: **SESSION NOTE** block (ink bg, amber label, underline-style input). Footer: ← BACK (ghost, returns to phase 1) / FINISH SESSION ↑ (ink).
- **On save**: computes total volume (Σ weight×reps); builds detail string (uniform weights → "82.5 ×5,5,4", mixed → "85×5, 82.5×5, 82.5×4"); flags **PR** per exercise when any set's weight exceeds stored max; prepends session to Training list with meta "4 EXERCISES · 3,788 KG"; per-exercise notes are appended to that exercise's note history; session note stored on the card.

### 6. Exercise drawer (desktop: side/overlay panel; mobile: bottom sheet)
Opened by tapping any exercise name in a session card. Ink header block: "EXERCISE LOG" micro-label, exercise name (34px), red **MAX** pill (computed as the top weight across all logged sessions). Body on paper: **HISTORY** — one row per occurrence across sessions (date left, detail right in Big Shoulders, PR badge when flagged); **NOTES** — aggregated note cards for this exercise (white, 2px `#ece4d2` border, 4px amber left spine, date micro-label + text), newest first; empty state: "No notes yet — add one while logging." ✕ or scrim closes.

### 7. Mobile (`FITLOG Mobile.dc.html`)
393×852 phone frame (46px bezel radius) on a dark backdrop — the frame is presentation only; implement as a responsive mobile app.
- Status bar (9:41 + battery), compact header (FITLOG + "11 DAYS" pill + WK 26 badge 38px).
- **Bottom tab bar**: 78px ink bar; three uppercase labels (Archivo 800 11px); active = cream + 20×3px red underline bar, inactive `#7c7468`.
- **FAB**: 58px cobalt circle "+", 2.5px ink border, bottom-right above tab bar; opens Log Session sheet.
- Dashboard = condensed desktop: cobalt hero (92px number, 72px medallion, compact finish-line), 2×2 stat tiles (radius 14), strength card with 3 mini PR boxes.
- Training/Goals mirror desktop with rounded cards; session cards have color spines, tappable dotted exercise names, NOTE footers.
- **Log Session + exercise drawer are bottom sheets** (slide up, grab handle, 24px top radius, max-height ~88–90%, internally scrollable). Same two-phase program flow, same per-set inputs with LAST/MAX chips, per-exercise note input (dashed-border field "+ Note — how did it feel?") and SESSION NOTE block.

## Interactions & Behavior
- Tab navigation swaps screens in place (no routing required, but routes are fine).
- Modals/sheets close on scrim tap and ✕; inner clicks don't propagate.
- PR detection: any entered set weight > exercise's stored max ⇒ PR badge on the saved session row (and the new weight becomes the max going forward).
- Weight logging recomputes: headline number (1 decimal), kg lost, kg to go, % (rounded), marker/fill position (clamped 0–100%).
- Number inputs: weight step 0.5 (0.1 in Log Weight), reps integer.
- Programs are fixed sample data (Push Day A / Pull Day A / Leg Day A, 4 exercises each with prescribed sets). An editable program builder was discussed but not designed.

## State Management
Reference the `Component` classes in the source files. Core state:
- `weight` (number) — single source for all bodyweight UI; constants START=108, GOAL=95
- `sessions[]` — `{ name, date, color, meta, note?, exercises: [{ name, detail, pr }] }`
- `exerciseNotes` — map of exercise name → `[{ date, text }]`
- `draftLog[]` (during logging) — `{ name, last, max, note, sets: [{ weight, reps }] }` + `sessionNote`, `programName/Short/Color`, `phase: 'pick' | 'log'`
- `active` tab, `modal`/`weightModal`/`drawer` visibility
- **Production requirement**: persist all of this locally (the prototype resets on reload by design).

## Assets
No image assets. Fonts from Google Fonts: **Big Shoulders Display** (500–900) and **Archivo** (400–800, + italics on desktop). The ⚑ finish flag and ✕/→/← glyphs are plain unicode text.

## Files
- `FITLOG Bold.dc.html` — desktop design (template + full logic class)
- `FITLOG Mobile.dc.html` — mobile design (template + full logic class)
