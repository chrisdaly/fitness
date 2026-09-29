# /setup - conversational first-run setup for a new FITLOG install

Walk a new user through setting up their own FITLOG. Ask questions, then write the
answers into the app. Do not make them edit code or read the schema.

Everything personal lives in the `goals` key/value table, reached over HTTP at
`POST /api/goals`. Never touch `fitness.db` with the sqlite3 CLI: the running server
holds it.

## Before you start

1. Is the server up? `curl -s localhost:7779/api/goals`. If not, start it with
   `npm install && npm run dev` from the project root and wait for it to answer.
2. Is this already set up? If the response has a `bw_start`, this install has a
   profile. Say whose numbers are already there and ask whether to change them or
   leave them alone. Never silently overwrite someone's cut.

## How to ask

Ask in the four rounds below, not all at once, and use the AskUserQuestion tool for
anything with a small set of sane answers so they can click instead of type. Free
text (name, weights, the why) is a plain question.

Keep it short. Nobody wants a form. If they give you a number with a unit you did not
expect, convert it and say what you stored: the app is metric throughout, so pounds
become kg and feet and inches become cm.

### Round 1: who they are

- **Name.** First name is fine. Shows in the header as "DECLAN'S LOG". Optional.
- **Age or date of birth.** Prefer the date, accept an age. Store `birth_date` as
  `YYYY-MM-DD`; from a bare age, use 1 July of the implied year and tell them it only
  affects the calorie estimate by a few kcal.
- **Height in cm.**

Height and age exist only to size the BMR in the calorie budget. Say that, because
asking someone's age with no reason given is rude.

### Round 2: the cut

- **Current weight**, which you log immediately: `POST /api/body-weight`
  `{"date": "<today>", "weight_kg": N}`. This is what makes the app come alive, so do
  it before anything else in this round.
- **Goal weight** → `bw_goal`.
- **Start weight** → `bw_start`. Default to the current weight. It only differs if
  they have already been cutting and want the progress bar to count from further back.
- **Rate** → `plan_kg_per_week`. Offer 0.5 (steady), 0.75, or 1.0 (aggressive) and
  say 0.5 to 0.75 is the sustainable range for most people. Default 0.75.
- **Cut start date** → `cut_start`. Default today.
- **One strength goal** → `bench_goal` in kg. Optional, it fills one tile.

### Round 3: wearables

Be straight about what this app actually supports, which is narrow:

- **Weight: Withings scales only.** Any other scale means logging weight by hand,
  which takes five seconds a day and is fine.
- **Steps, sleep, resting HR and HRV: Fitbit only**, and via the Google Health API,
  which means a Google Cloud project of their own. Garmin, Apple Watch, Oura, Whoop
  and Samsung are **not** supported. Do not imply otherwise or offer to add them in
  passing: it is a real piece of work, not a config line.

Ask what they have. If it is Withings or Fitbit, walk them through the matching
section of `README.md` and stop at the point where they have to click through a
developer console, because they have to do that part themselves. If it is anything
else, tell them the app works fully on manual entry and move on without apologising
for it.

Worth saying out loud for a Fitbit user: while their Google Cloud project is in
Testing mode, the refresh token dies about weekly and they have to re-consent.

### Round 4: daily targets and the why

- **Step target** → `step_target`. Default 10000.
- **Sleep target in hours** → `sleep_target`. Default 7.
- **The why.** One or two sentences on why they are doing this, stored in `why`. It
  surfaces on hard days: a red readiness call, or a weigh-in that jumps half a kilo.
  Ask for it properly, in their own words. Do not write it for them, and do not
  suggest they skip it, but let them skip it if they want.

## Then: their training split

`PROGRAMS` and `ROUTINE` near the top of the `<script>` block in `index.html` ship
with a Push / Pull / Legs split. Ask what they actually train.

- If they lift a different split, or the same split with different machines, edit
  `PROGRAMS` for them: one entry per day type, each with an exercise list, `sets` and
  `defaultReps`. Keep the ids and `short` names uppercase, and pick a `TYPE_COLOR`
  entry for any new day type.
- Set `ROUTINE` to their week, `null` for rest days.
- If they do not know their split yet, leave the default and say it is one array to
  change later.

Exercise names are matched as plain text against their history, so tell them to keep
a name stable once they have logged it.

## Finish

1. Write everything: one `POST /api/goals` with the whole profile object.
2. Reload the app and check it: the hero shows their weight and goal, the food tile
   shows a kcal budget rather than asking for height, and the header says their name.
3. Tell them the three things that are not obvious:
   - **There is no login.** On localhost that is fine. On a public URL it is not.
   - **Their data is one SQLite file**, `fitness.db`, not in git. Back it up.
   - **`/daily`** is the original author's Apple Notes workflow and is not needed.
     The app logs sessions itself.
4. Offer to log their first session with them, or leave them to it.

## Rules

- No em dashes anywhere.
- Metric throughout. Convert anything else and say so.
- Never invent a number they did not give you. An unanswered field stays unset, and
  the app already handles unset fields.
