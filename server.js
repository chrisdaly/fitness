const express = require('express')
const { Database } = require('node-sqlite3-wasm')
const path = require('path')

const fs = require('fs')
const { execSync, spawn } = require('child_process')
const PORT = process.env.PORT || 7779
const dbPath = process.env.DB_PATH || path.join(__dirname, 'fitness.db')
// node-sqlite3-wasm uses a .lock directory — remove stale one from crashed previous run
try { fs.rmdirSync(dbPath + '.lock') } catch (e) {}
const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    date       TEXT    NOT NULL,
    name       TEXT    NOT NULL DEFAULT 'Session',
    type       TEXT    DEFAULT 'lift',
    color      TEXT    DEFAULT '#f4a800',
    note       TEXT,
    ended_at   TEXT,
    created_at TEXT    DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS exercises (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    weight_kg  REAL,
    order_idx  INTEGER DEFAULT 0,
    notes      TEXT
  );
  CREATE TABLE IF NOT EXISTS sets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    set_num     INTEGER NOT NULL,
    reps        INTEGER NOT NULL,
    weight_kg   REAL
  );
  CREATE TABLE IF NOT EXISTS body_weight (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    date      TEXT    UNIQUE NOT NULL,
    weight_kg REAL    NOT NULL,
    created_at TEXT   DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    date         TEXT  NOT NULL,
    distance_km  REAL  NOT NULL,
    duration_sec INTEGER,
    notes        TEXT,
    created_at   TEXT  DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS goals (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS exercise_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    date        TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS daily_steps (
    date       TEXT PRIMARY KEY,
    steps      INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS daily_diet (
    date       TEXT PRIMARY KEY,
    on_plan    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS daily_sleep (
    date       TEXT PRIMARY KEY,
    slept_ok   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS insight_notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content    TEXT NOT NULL,
    category   TEXT DEFAULT 'general',
    created_at TEXT DEFAULT (datetime('now'))
  );
`)

const app = express()
app.use(express.json())
app.use(express.static(__dirname))

// node-sqlite3-wasm requires an array for multiple bind params
const q = (sql) => db.prepare(sql)

function getSession(id) {
  const session = q('SELECT * FROM sessions WHERE id = ?').get([id])
  if (!session) return null
  const exercises = q('SELECT * FROM exercises WHERE session_id = ? ORDER BY order_idx, id').all([id])
  for (const ex of exercises) {
    ex.sets = q('SELECT * FROM sets WHERE exercise_id = ? ORDER BY set_num').all([ex.id])
  }
  session.exercises = exercises
  return session
}

function sessionSummary(s) {
  const exs = q('SELECT id FROM exercises WHERE session_id = ?').all([s.id])
  const allSets = exs.flatMap(e => q('SELECT reps, weight_kg FROM sets WHERE exercise_id = ?').all([e.id]))
  return {
    ...s,
    exercise_count: exs.length,
    total_sets: allSets.length,
    total_reps: allSets.reduce((a, x) => a + (x.reps || 0), 0),
    volume_kg: Math.round(allSets.reduce((a, x) => a + (x.reps || 0) * (x.weight_kg || 0), 0))
  }
}

// Today snapshot
app.get('/api/today', (req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const row = q('SELECT id FROM sessions WHERE date = ? ORDER BY id DESC LIMIT 1').get([today])
  const bwAll = q('SELECT * FROM body_weight ORDER BY date DESC LIMIT 600').all([])
  const bwHistory = bwAll.slice().reverse()
  const stepsRow = q('SELECT steps FROM daily_steps WHERE date = ?').get([today])
  const dietRow = q('SELECT on_plan FROM daily_diet WHERE date = ?').get([today])
  const sleepRow = q('SELECT slept_ok FROM daily_sleep WHERE date = ?').get([today])
  res.json({
    session: row ? getSession(row.id) : null,
    bodyWeight: bwAll[0] || null,
    bwHistory,
    lastRun: q('SELECT * FROM runs ORDER BY date DESC, id DESC LIMIT 1').get([]) || null,
    todaySteps: stepsRow ? stepsRow.steps : null,
    todayDiet: dietRow ? !!dietRow.on_plan : null,
    todaySleepHours: sleepRow ? sleepRow.slept_ok : null
  })
})

// Create session
app.post('/api/sessions', (req, res) => {
  const { name, type, color, date } = req.body
  const d = date || new Date().toISOString().slice(0, 10)
  const r = q('INSERT INTO sessions (date, name, type, color) VALUES (?, ?, ?, ?)').run([d, name || 'Session', type || 'lift', color || '#f4a800'])
  res.json(getSession(r.lastInsertRowid))
})

// Batch log: create session + all exercises + all sets in one call
app.post('/api/log', (req, res) => {
  const { name, type, color, note, date, exercises } = req.body
  const d = date || new Date().toISOString().slice(0, 10)
  const sR = q('INSERT INTO sessions (date, name, type, color, note) VALUES (?, ?, ?, ?, ?)').run([d, name || 'Session', type || 'lift', color || '#f4a800', note || null])
  const sid = sR.lastInsertRowid
  let ord = 0
  for (const ex of (exercises || [])) {
    const eR = q('INSERT INTO exercises (session_id, name, weight_kg, notes, order_idx) VALUES (?, ?, ?, ?, ?)').run([sid, ex.name, ex.weight_kg || null, ex.notes || null, ord++])
    const eid = eR.lastInsertRowid
    let snum = 1
    for (const set of (ex.sets || [])) {
      const reps = parseInt(set.reps) || 0
      const wkg = parseFloat(set.weight_kg) || null
      if (reps > 0) {
        q('INSERT INTO sets (exercise_id, set_num, reps, weight_kg) VALUES (?, ?, ?, ?)').run([eid, snum++, reps, wkg])
      }
    }
    if (ex.note && ex.note.trim()) {
      q('INSERT INTO exercise_notes (name, date, text) VALUES (?, ?, ?)').run([ex.name, d, ex.note.trim()])
    }
  }
  q(`UPDATE sessions SET ended_at = datetime('now') WHERE id = ?`).run([sid])
  res.json(getSession(sid))
})

// List sessions
app.get('/api/sessions', (req, res) => {
  const sessions = q('SELECT * FROM sessions ORDER BY date DESC, id DESC LIMIT 90').all([])
  res.json(sessions.map(sessionSummary))
})

// Get session
app.get('/api/sessions/:id', (req, res) => {
  const s = getSession(+req.params.id)
  if (!s) return res.status(404).json({ error: 'not found' })
  res.json(s)
})

// Delete session
app.delete('/api/sessions/:id', (req, res) => {
  q('DELETE FROM sessions WHERE id = ?').run([+req.params.id])
  res.json({ ok: true })
})

// Body weight
app.post('/api/body-weight', (req, res) => {
  const { date, weight_kg } = req.body
  const d = date || new Date().toISOString().slice(0, 10)
  q('INSERT INTO body_weight (date, weight_kg) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg').run([d, weight_kg])
  res.json(q('SELECT * FROM body_weight WHERE date = ?').get([d]))
})

app.get('/api/body-weight', (req, res) => {
  res.json(q('SELECT * FROM body_weight ORDER BY date DESC LIMIT 60').all([]))
})

// Steps
app.post('/api/steps', (req, res) => {
  const { date, steps } = req.body
  const d = date || new Date().toISOString().slice(0, 10)
  q('INSERT INTO daily_steps (date, steps) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET steps = excluded.steps').run([d, steps])
  res.json(q('SELECT * FROM daily_steps WHERE date = ?').get([d]))
})

app.get('/api/steps', (req, res) => {
  res.json(q('SELECT * FROM daily_steps ORDER BY date DESC LIMIT 30').all([]))
})

// Diet
app.post('/api/diet', (req, res) => {
  const { date, on_plan } = req.body
  const d = date || new Date().toISOString().slice(0, 10)
  const val = on_plan ? 1 : 0
  q('INSERT INTO daily_diet (date, on_plan) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET on_plan = excluded.on_plan').run([d, val])
  res.json({ date: d, on_plan: !!val })
})

// Sleep (stores hours in slept_ok column; 0 = not logged)
app.post('/api/sleep', (req, res) => {
  const { date, hours } = req.body
  const d = date || new Date().toISOString().slice(0, 10)
  const h = parseFloat(hours) || 0
  q('INSERT INTO daily_sleep (date, slept_ok) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET slept_ok = excluded.slept_ok').run([d, h])
  res.json({ date: d, hours: h })
})

app.get('/api/sleep', (req, res) => {
  res.json(q('SELECT date, slept_ok as hours FROM daily_sleep ORDER BY date DESC LIMIT 60').all([]))
})

app.get('/api/diet', (req, res) => {
  res.json(q('SELECT date, on_plan FROM daily_diet ORDER BY date DESC LIMIT 60').all([]))
})

// Combined habits for heatmap (last 84 days = 12 weeks)
app.get('/api/habits', (req, res) => {
  const days = Math.min(parseInt(req.query.days) || 84, 365)
  const since = new Date(); since.setDate(since.getDate() - days + 1)
  const sinceStr = since.toISOString().slice(0, 10)
  const sleeps  = q('SELECT date, slept_ok as hours FROM daily_sleep WHERE date >= ?').all([sinceStr])
  const diets   = q('SELECT date, on_plan FROM daily_diet WHERE date >= ?').all([sinceStr])
  const steps   = q('SELECT date, steps FROM daily_steps WHERE date >= ?').all([sinceStr])
  const workouts= q('SELECT DISTINCT date FROM sessions WHERE date >= ?').all([sinceStr])
  const sm = Object.fromEntries(sleeps.map(r => [r.date, r.hours]))
  const dm = Object.fromEntries(diets.map(r => [r.date, r.on_plan]))
  const stm= Object.fromEntries(steps.map(r => [r.date, r.steps]))
  const ws = new Set(workouts.map(r => r.date))
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const date = d.toISOString().slice(0, 10)
    result.push({ date, sleep_h: sm[date] || 0, diet_ok: dm[date] || 0, steps: stm[date] || 0, workout: ws.has(date) ? 1 : 0 })
  }
  res.json(result)
})

// Runs
app.post('/api/runs', (req, res) => {
  const { date, distance_km, duration_sec, notes } = req.body
  const d = date || new Date().toISOString().slice(0, 10)
  const r = q('INSERT INTO runs (date, distance_km, duration_sec, notes) VALUES (?, ?, ?, ?)').run([d, distance_km, duration_sec || null, notes || null])
  res.json(q('SELECT * FROM runs WHERE id = ?').get([r.lastInsertRowid]))
})

app.get('/api/runs', (req, res) => {
  res.json(q('SELECT * FROM runs ORDER BY date DESC, id DESC LIMIT 60').all([]))
})

app.get('/api/prs', (req, res) => {
  res.json(q(`
    SELECT e.name, MAX(s.weight_kg) as best_kg, MAX(s.reps) as best_reps
    FROM sets s JOIN exercises e ON e.id = s.exercise_id
    WHERE s.weight_kg IS NOT NULL AND s.weight_kg > 0
    GROUP BY LOWER(TRIM(e.name))
    ORDER BY best_kg DESC
  `).all([]))
})

app.patch('/api/sets/:id', (req, res) => {
  const { weight_kg, reps } = req.body
  const updates = []
  const vals = []
  if (weight_kg !== undefined) { updates.push('weight_kg = ?'); vals.push(weight_kg === null ? null : parseFloat(weight_kg)) }
  if (reps !== undefined) { updates.push('reps = ?'); vals.push(parseInt(reps)) }
  if (!updates.length) return res.status(400).json({ error: 'nothing to update' })
  vals.push(+req.params.id)
  q(`UPDATE sets SET ${updates.join(', ')} WHERE id = ?`).run(vals)
  res.json(q('SELECT * FROM sets WHERE id = ?').get([+req.params.id]))
})

// Goals (simple key/value store)
app.get('/api/goals', (req, res) => {
  const rows = q('SELECT key, value FROM goals').all([])
  const obj = {}
  rows.forEach(r => { obj[r.key] = isNaN(r.value) ? r.value : +r.value })
  res.json(obj)
})

app.post('/api/goals', (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    q('INSERT INTO goals (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run([key, String(value)])
  }
  const rows = q('SELECT key, value FROM goals').all([])
  const obj = {}
  rows.forEach(r => { obj[r.key] = isNaN(r.value) ? r.value : +r.value })
  res.json(obj)
})

// Exercise history (for drawer)
app.get('/api/exercise-history/:name', (req, res) => {
  const name = req.params.name
  const history = q(`
    SELECT s.date, s.name as session_name, e.id as exercise_id,
           e.name as exercise_name, e.weight_kg
    FROM exercises e JOIN sessions s ON s.id = e.session_id
    WHERE LOWER(TRIM(e.name)) = LOWER(TRIM(?))
    ORDER BY s.date DESC LIMIT 10
  `).all([name])
  for (const h of history) {
    h.sets = q('SELECT reps, weight_kg FROM sets WHERE exercise_id = ? ORDER BY set_num').all([h.exercise_id])
  }
  const notes = q('SELECT * FROM exercise_notes WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) ORDER BY date DESC LIMIT 10').all([name])
  const prRow = q('SELECT MAX(s.weight_kg) as best_kg FROM sets s JOIN exercises e ON e.id = s.exercise_id WHERE LOWER(TRIM(e.name)) = LOWER(TRIM(?)) AND s.weight_kg IS NOT NULL').get([name])
  res.json({ history, notes, best_kg: prRow?.best_kg || null })
})

// Lift history for sparklines
app.get('/api/lift-history', (req, res) => {
  res.json(q(`
    SELECT TRIM(e.name) as name, s.date, MAX(st.weight_kg) as max_kg
    FROM sets st
    JOIN exercises e ON e.id = st.exercise_id
    JOIN sessions s ON s.id = e.session_id
    WHERE st.weight_kg IS NOT NULL AND st.weight_kg > 0
    GROUP BY LOWER(TRIM(e.name)), s.date
    ORDER BY s.date ASC
  `).all([]))
})

// ── IMPORT ──────────────────────────────────────────────────────────────────

app.post('/api/import/confirm', (req, res) => {
  const { sessions } = req.body
  if (!Array.isArray(sessions)) return res.status(400).json({ error: 'sessions must be array' })
  let imported = 0, skipped = 0
  for (const s of sessions) {
    try {
      const d = s.date
      if (!d) { skipped++; continue }
      // Dedup: skip if session with same date+type already exists
      const existing = q('SELECT id FROM sessions WHERE date = ? AND type = ?').get([d, s.type || 'lift'])
      if (existing) { skipped++; continue }
      const sR = q('INSERT INTO sessions (date, name, type, color, note) VALUES (?, ?, ?, ?, ?)').run([d, s.name || s.type || 'Session', s.type || 'lift', s.color || '#f4a800', s.note || null])
      const sid = sR.lastInsertRowid
      let ord = 0
      for (const ex of (s.exercises || [])) {
        const eR = q('INSERT INTO exercises (session_id, name, order_idx) VALUES (?, ?, ?)').run([sid, ex.name, ord++])
        const eid = eR.lastInsertRowid
        let snum = 1
        for (const set of (ex.sets || [])) {
          const reps = Math.round(parseFloat(set.reps)) || 0
          const wkg = set.weight_kg != null ? parseFloat(set.weight_kg) : null
          if (reps > 0) q('INSERT INTO sets (exercise_id, set_num, reps, weight_kg) VALUES (?, ?, ?, ?)').run([eid, snum++, reps, wkg])
        }
      }
      q(`UPDATE sessions SET ended_at = datetime('now') WHERE id = ?`).run([sid])
      if (s.bodyweight_kg) {
        q('INSERT OR IGNORE INTO body_weight (date, weight_kg) VALUES (?, ?)').run([d, s.bodyweight_kg])
      }
      imported++
    } catch (e) { skipped++ }
  }
  res.json({ imported, skipped })
})

// Insight notes
app.get('/api/notes', (req, res) => {
  res.json(q('SELECT * FROM insight_notes ORDER BY created_at DESC').all([]))
})

app.post('/api/notes', (req, res) => {
  const { content, category } = req.body
  if (!content?.trim()) return res.status(400).json({ error: 'content required' })
  const r = q(`INSERT INTO insight_notes (content, category) VALUES (?, ?)`).run([content.trim(), category || 'general'])
  res.json(q('SELECT * FROM insight_notes WHERE id = ?').get([r.lastInsertRowid]))
})

app.delete('/api/notes/:id', (req, res) => {
  q('DELETE FROM insight_notes WHERE id = ?').run([req.params.id])
  res.json({ ok: true })
})

// ── GOOGLE HEALTH / FITBIT SYNC ─────────────────────────────────────────────
const { google } = require('googleapis')
const TOKENS_PATH = process.env.FLY_APP_NAME
  ? '/data/.google-tokens.json'
  : path.join(__dirname, '.google-tokens.json')
const CREDS = process.env.FLY_APP_NAME
  ? { client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uris: ['https://fitlog-chris.fly.dev/auth/google-health/callback'] }
  : JSON.parse(fs.readFileSync(path.join(__dirname, '.google-credentials.json'))).web

const oauth2Client = new google.auth.OAuth2(
  CREDS.client_id,
  CREDS.client_secret,
  CREDS.redirect_uris[0]
)

const SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.sleep.read',
  'https://www.googleapis.com/auth/fitness.heart_rate.read',
]

function loadTokens() {
  try { return JSON.parse(fs.readFileSync(TOKENS_PATH)) } catch { return null }
}
function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2))
}

const savedTokens = loadTokens()
if (savedTokens) oauth2Client.setCredentials(savedTokens)
oauth2Client.on('tokens', t => { saveTokens({ ...loadTokens(), ...t }) })

app.get('/auth/google-health', (req, res) => {
  const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' })
  res.redirect(url)
})

app.get('/auth/google-health/callback', async (req, res) => {
  const { code } = req.query
  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)
  saveTokens(tokens)
  res.send('<h2>Fitbit connected!</h2><p>You can close this tab. <a href="/">Back to FITLOG</a></p>')
})

app.get('/api/fitbit/status', (req, res) => {
  const tokens = loadTokens()
  res.json({ connected: !!(tokens?.access_token), last_sync: tokens?.last_sync || null })
})

app.post('/api/fitbit/sync', async (req, res) => {
  const tokens = loadTokens()
  if (!tokens?.access_token) return res.status(401).json({ error: 'Not connected. Visit /auth/google-health first.' })
  oauth2Client.setCredentials(tokens)

  const days = parseInt(req.query.days) || 7
  const now = Date.now()
  const startMs = now - days * 24 * 60 * 60 * 1000

  const fitness = google.fitness({ version: 'v1', auth: oauth2Client })

  async function aggregate(dataTypeName) {
    const r = await fitness.users.dataset.aggregate({
      userId: 'me',
      requestBody: {
        aggregateBy: [{ dataTypeName }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startMs,
        endTimeMillis: now,
      },
    })
    return r.data.bucket || []
  }

  const results = { synced: [], skipped: [] }

  // Steps
  const stepBuckets = await aggregate('com.google.step_count.delta')
  for (const b of stepBuckets) {
    const date = new Date(parseInt(b.startTimeMillis)).toISOString().slice(0, 10)
    const steps = b.dataset?.[0]?.point?.reduce((s, p) => s + (p.value?.[0]?.intVal || 0), 0) || 0
    if (steps > 0) {
      q('INSERT INTO daily_steps (date, steps) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET steps = excluded.steps').run([date, steps])
      results.synced.push(`steps ${date}: ${steps}`)
    }
  }

  // Weight
  const weightBuckets = await aggregate('com.google.weight')
  for (const b of weightBuckets) {
    const date = new Date(parseInt(b.startTimeMillis)).toISOString().slice(0, 10)
    const pts = b.dataset?.[0]?.point || []
    if (pts.length) {
      const kg = pts[pts.length - 1].value?.[0]?.fpVal
      if (kg) {
        q('INSERT INTO body_weight (date, weight_kg) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg').run([date, Math.round(kg * 10) / 10])
        results.synced.push(`weight ${date}: ${kg}kg`)
      }
    }
  }

  // Sleep (total hours per day)
  const sleepBuckets = await aggregate('com.google.sleep.segment')
  for (const b of sleepBuckets) {
    const date = new Date(parseInt(b.startTimeMillis)).toISOString().slice(0, 10)
    const pts = b.dataset?.[0]?.point || []
    let sleepMs = 0
    for (const p of pts) {
      const type = p.value?.[1]?.intVal
      if (type >= 1) sleepMs += parseInt(p.endTimeNanos - p.startTimeNanos) / 1e6
    }
    const hours = Math.round((sleepMs / 3600000) * 10) / 10
    if (hours > 0) {
      q('INSERT INTO daily_sleep (date, slept_ok) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET slept_ok = excluded.slept_ok').run([date, hours])
      results.synced.push(`sleep ${date}: ${hours}h`)
    }
  }

  const newTokens = { ...loadTokens(), last_sync: new Date().toISOString() }
  saveTokens(newTokens)
  res.json(results)
})

// ── DEV ONLY ────────────────────────────────────────────────────────────────
if (!process.env.FLY_APP_NAME) {
  app.post('/api/dev/sync-prod', (req, res) => {
    res.json({ ok: true })
    setTimeout(() => {
      try {
        const backup = dbPath + '.bak'
        if (fs.existsSync(backup)) fs.unlinkSync(backup)
        fs.renameSync(dbPath, backup)
        execSync(`flyctl ssh sftp get /data/fitness.db ${dbPath} --app fitlog-chris`, { stdio: 'inherit' })
        console.log('prod DB synced, restarting...')
      } catch (e) {
        console.error('sync failed:', e.message)
      }
      spawn(process.argv[0], process.argv.slice(1), { detached: true, stdio: 'inherit' }).unref()
      process.exit(0)
    }, 200)
  })
}

app.listen(PORT, '0.0.0.0', () => console.log(`fitness on http://0.0.0.0:${PORT}`))
