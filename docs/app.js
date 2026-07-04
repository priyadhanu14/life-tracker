/* ---------- Config ---------- */
const CFG_KEY = 'lifeTracker.config';
let CONFIG = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');

const DATA = { Fitness: [], Health: [], Expenses: [], Finances: [], Time: [] };
let currentTab = 'dashboard';
let moneyView = 'expenses';
const charts = {}; // canvasId -> Chart instance

const FITNESS_TYPES = ['Cardio', 'Strength', 'Yoga', 'Sports', 'Walking', 'Other'];
const MOODS = ['😀 Great', '🙂 Good', '😐 Okay', '🙁 Low', '😞 Bad'];
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Shopping', 'Entertainment', 'Health', 'Other'];
const PAYMENT_METHODS = ['Cash', 'Card', 'UPI/Bank Transfer', 'Other'];
const FINANCE_TYPES = ['Income', 'Savings', 'Investment', 'Debt Payment'];
const TIME_CATEGORIES = ['Work', 'Study', 'Exercise', 'Sleep', 'Leisure', 'Chores', 'Social', 'Other'];

/* ---------- API helpers ---------- */
function isConfigured() {
  return !!(CONFIG.apiUrl && CONFIG.token);
}

async function apiGetAll() {
  const url = `${CONFIG.apiUrl}?token=${encodeURIComponent(CONFIG.token)}&sheet=all`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function apiAdd(sheet, data) {
  const res = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    body: JSON.stringify({ token: CONFIG.token, sheet, data })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

async function apiDelete(sheet, row) {
  const res = await fetch(CONFIG.apiUrl, {
    method: 'POST',
    body: JSON.stringify({ token: CONFIG.token, sheet, action: 'delete', row })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2400);
}

/* ---------- Settings modal ---------- */
const modal = document.getElementById('settings-modal');
document.getElementById('settings-btn').onclick = () => {
  document.getElementById('cfg-url').value = CONFIG.apiUrl || '';
  document.getElementById('cfg-token').value = CONFIG.token || '';
  modal.classList.remove('hidden');
};
document.getElementById('cfg-cancel').onclick = () => modal.classList.add('hidden');
document.getElementById('cfg-save').onclick = () => {
  const apiUrl = document.getElementById('cfg-url').value.trim();
  const token = document.getElementById('cfg-token').value.trim();
  if (!apiUrl || !token) { toast('Both fields are required'); return; }
  CONFIG = { apiUrl, token };
  localStorage.setItem(CFG_KEY, JSON.stringify(CONFIG));
  modal.classList.add('hidden');
  refresh();
};

/* ---------- Nav ---------- */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    render();
  };
});

/* ---------- Utils ---------- */
// Date-only strings ("YYYY-MM-DD") from <input type=date> or the Sheet must be
// parsed as local dates — `new Date("2026-07-01")` parses as UTC midnight,
// which lands on the wrong local day/month in timezones behind UTC.
function parseDate(d) {
  if (typeof d === 'string') {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(d);
}
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => parseDate(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const num = (v) => Number(v) || 0;
const sameMonth = (d) => {
  const a = parseDate(d), b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
};
const sameDay = (d) => parseDate(d).toDateString() === new Date().toDateString();
const withinDays = (d, n) => (Date.now() - parseDate(d).getTime()) <= n * 86400000;
function sortByDateDesc(rows) {
  return [...rows].sort((a, b) => parseDate(b.Date) - parseDate(a.Date));
}
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

/* ---------- Refresh / render ---------- */
async function refresh() {
  if (!isConfigured()) { render(); return; }
  try {
    const all = await apiGetAll();
    Object.assign(DATA, all);
    render();
  } catch (err) {
    toast('Failed to load: ' + err.message);
  }
}

function render() {
  const content = document.getElementById('content');
  const title = { dashboard: 'Dashboard', fitness: 'Fitness', health: 'Health', money: 'Money', time: 'Time' }[currentTab];
  document.getElementById('header-title').textContent = title;

  if (!isConfigured()) {
    content.innerHTML = `
      <div class="card">
        <h2>Setup needed</h2>
        <p class="muted">Tap the ⚙️ icon above and paste your Apps Script Web App URL and secret token to connect your Google Sheet.</p>
      </div>`;
    return;
  }

  const renderers = { dashboard: renderDashboard, fitness: renderFitness, health: renderHealth, money: renderMoney, time: renderTime };
  renderers[currentTab]();
}

/* ---------- Generic entry list ---------- */
function entryListHtml(rows, lineFn) {
  if (!rows.length) return '<div class="empty">No entries yet</div>';
  return `<div class="entry-list">${rows.map(r => {
    const { main, sub, amount } = lineFn(r);
    return `<div class="entry-row">
      <div>
        <div class="main">${main}</div>
        <div class="sub">${sub}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        ${amount !== undefined ? `<span class="amount">${amount}</span>` : ''}
        <button class="del" data-sheet="${r._sheet}" data-row="${r._row}">✕</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function bindDeleteButtons() {
  document.querySelectorAll('.del').forEach(btn => {
    btn.onclick = async () => {
      const sheet = btn.dataset.sheet;
      const row = Number(btn.dataset.row);
      try {
        await apiDelete(sheet, row);
        toast('Deleted');
        refresh();
      } catch (err) {
        toast('Delete failed: ' + err.message);
      }
    };
  });
}

function bindForm(formId, sheet, mapFn) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = mapFn(fd);
    try {
      await apiAdd(sheet, data);
      toast('Saved');
      form.reset();
      const dateInput = form.querySelector('input[type="date"]');
      if (dateInput) dateInput.value = todayStr();
      refresh();
    } catch (err) {
      toast('Save failed: ' + err.message);
    }
  };
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const content = document.getElementById('content');
  const fitness = DATA.Fitness || [], health = DATA.Health || [], expenses = DATA.Expenses || [], finances = DATA.Finances || [], time = DATA.Time || [];

  const workoutsThisWeek = fitness.filter(r => withinDays(r.Date, 7)).length;
  const lastSleep = sortByDateDesc(health)[0]?.Sleep;
  const spentThisMonth = expenses.filter(r => sameMonth(r.Date)).reduce((s, r) => s + num(r.Amount), 0);
  const incomeThisMonth = finances.filter(r => sameMonth(r.Date) && r.Type === 'Income').reduce((s, r) => s + num(r.Amount), 0);

  const todayTime = time.filter(r => sameDay(r.Date));
  const byCat = {};
  todayTime.forEach(r => { byCat[r.Category] = (byCat[r.Category] || 0) + num(r.Hours); });

  const recent = [
    ...fitness.map(r => ({ ...r, _sheet: 'Fitness', _label: `Workout: ${r.Type}` })),
    ...health.map(r => ({ ...r, _sheet: 'Health', _label: 'Health log' })),
    ...expenses.map(r => ({ ...r, _sheet: 'Expenses', _label: `Expense: ${r.Category}` })),
    ...finances.map(r => ({ ...r, _sheet: 'Finances', _label: `${r.Type}` })),
    ...time.map(r => ({ ...r, _sheet: 'Time', _label: `Time: ${r.Activity}` }))
  ];
  const recentSorted = sortByDateDesc(recent).slice(0, 6);

  content.innerHTML = `
    <div class="card">
      <h2>This week / month</h2>
      <div class="stat-grid">
        <div class="stat"><div class="value">${workoutsThisWeek}</div><div class="label">Workouts (7d)</div></div>
        <div class="stat"><div class="value">${lastSleep ?? '—'}</div><div class="label">Last sleep (h)</div></div>
        <div class="stat"><div class="value">${spentThisMonth.toFixed(0)}</div><div class="label">Spent this month</div></div>
        <div class="stat"><div class="value">${incomeThisMonth.toFixed(0)}</div><div class="label">Income this month</div></div>
      </div>
    </div>
    <div class="card">
      <h2>Today's time</h2>
      <div class="chart-wrap"><canvas id="chart-today-time"></canvas></div>
    </div>
    <div class="card">
      <h2>Recent activity</h2>
      ${recentSorted.length ? `<div class="entry-list">${recentSorted.map(r => `
        <div class="entry-row">
          <div>
            <div class="main">${r._label}</div>
            <div class="sub">${fmtDate(r.Date)}</div>
          </div>
        </div>`).join('')}</div>` : '<div class="empty">Nothing logged yet</div>'}
    </div>
  `;

  destroyChart('chart-today-time');
  const labels = Object.keys(byCat);
  const ctx = document.getElementById('chart-today-time');
  if (labels.length) {
    charts['chart-today-time'] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: labels.map(l => byCat[l]), backgroundColor: palette(labels.length) }] },
      options: { plugins: { legend: { labels: { color: '#cbd5e1' } } } }
    });
  } else {
    ctx.replaceWith(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'No time logged today' }));
  }
}

function palette(n) {
  const base = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee', '#f87171'];
  return Array.from({ length: n }, (_, i) => base[i % base.length]);
}

/* ---------- Fitness ---------- */
function renderFitness() {
  const rows = sortByDateDesc(DATA.Fitness || []);
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card">
      <h3>Log a workout</h3>
      <form id="form-fitness" class="entry-form">
        <label>Date <input type="date" name="Date" value="${todayStr()}" required></label>
        <label>Type
          <select name="Type">${FITNESS_TYPES.map(t => `<option>${t}</option>`).join('')}</select>
        </label>
        <label>Duration (minutes) <input type="number" name="Duration" min="0" required></label>
        <label>Calories burned <input type="number" name="Calories" min="0"></label>
        <label>Notes <input type="text" name="Notes"></label>
        <button class="btn primary block" type="submit">Add workout</button>
      </form>
    </div>
    <div class="card">
      <h2>Last 7 days</h2>
      <div class="chart-wrap"><canvas id="chart-fitness-week"></canvas></div>
    </div>
    <div class="card">
      <h2>History</h2>
      ${entryListHtml(rows.map(r => ({ ...r, _sheet: 'Fitness' })), r => ({
        main: `${r.Type} — ${r.Duration} min`,
        sub: `${fmtDate(r.Date)}${r.Notes ? ' · ' + r.Notes : ''}`,
        amount: r.Calories ? `${r.Calories} cal` : undefined
      }))}
    </div>
  `;
  bindForm('form-fitness', 'Fitness', fd => ({
    Date: fd.get('Date'), Type: fd.get('Type'), Duration: fd.get('Duration'), Calories: fd.get('Calories'), Notes: fd.get('Notes')
  }));
  bindDeleteButtons();

  destroyChart('chart-fitness-week');
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d;
  });
  const totals = days.map(d => rows.filter(r => sameDayAs(r.Date, d)).reduce((s, r) => s + num(r.Duration), 0));
  charts['chart-fitness-week'] = new Chart(document.getElementById('chart-fitness-week'), {
    type: 'bar',
    data: { labels: days.map(d => d.toLocaleDateString(undefined, { weekday: 'short' })), datasets: [{ label: 'Minutes', data: totals, backgroundColor: '#60a5fa' }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#9fb0c9' } }, y: { ticks: { color: '#9fb0c9' } } } }
  });
}
function sameDayAs(d1, d2) { return parseDate(d1).toDateString() === d2.toDateString(); }

/* ---------- Health ---------- */
function renderHealth() {
  const rows = sortByDateDesc(DATA.Health || []);
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card">
      <h3>Log health</h3>
      <form id="form-health" class="entry-form">
        <label>Date <input type="date" name="Date" value="${todayStr()}" required></label>
        <label>Weight (kg) <input type="number" step="0.1" name="Weight"></label>
        <label>Sleep (hours) <input type="number" step="0.1" name="Sleep"></label>
        <label>Mood
          <select name="Mood">${MOODS.map(m => `<option>${m}</option>`).join('')}</select>
        </label>
        <label>Water (liters) <input type="number" step="0.1" name="Water"></label>
        <label>Notes <input type="text" name="Notes"></label>
        <button class="btn primary block" type="submit">Add entry</button>
      </form>
    </div>
    <div class="card">
      <h2>Weight trend</h2>
      <div class="chart-wrap"><canvas id="chart-weight"></canvas></div>
    </div>
    <div class="card">
      <h2>History</h2>
      ${entryListHtml(rows.map(r => ({ ...r, _sheet: 'Health' })), r => ({
        main: `${r.Mood || ''} ${r.Weight ? r.Weight + 'kg' : ''}`.trim() || 'Entry',
        sub: `${fmtDate(r.Date)} · Sleep ${r.Sleep ?? '—'}h · Water ${r.Water ?? '—'}L${r.Notes ? ' · ' + r.Notes : ''}`
      }))}
    </div>
  `;
  bindForm('form-health', 'Health', fd => ({
    Date: fd.get('Date'), Weight: fd.get('Weight'), Sleep: fd.get('Sleep'), Mood: fd.get('Mood'), Water: fd.get('Water'), Notes: fd.get('Notes')
  }));
  bindDeleteButtons();

  destroyChart('chart-weight');
  const withWeight = sortByDateDesc(rows).filter(r => r.Weight).reverse().slice(-14);
  const ctx = document.getElementById('chart-weight');
  if (withWeight.length) {
    charts['chart-weight'] = new Chart(ctx, {
      type: 'line',
      data: { labels: withWeight.map(r => fmtDate(r.Date)), datasets: [{ label: 'Weight (kg)', data: withWeight.map(r => num(r.Weight)), borderColor: '#34d399', tension: 0.3 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#9fb0c9' } }, y: { ticks: { color: '#9fb0c9' } } } }
    });
  } else {
    ctx.replaceWith(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'No weight entries yet' }));
  }
}

/* ---------- Money (Expenses + Finances) ---------- */
function renderMoney() {
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="segment">
      <button id="seg-expenses" class="${moneyView === 'expenses' ? 'active' : ''}">Expenses</button>
      <button id="seg-finances" class="${moneyView === 'finances' ? 'active' : ''}">Finances</button>
    </div>
    <div id="money-content"></div>
  `;
  document.getElementById('seg-expenses').onclick = () => { moneyView = 'expenses'; renderMoney(); };
  document.getElementById('seg-finances').onclick = () => { moneyView = 'finances'; renderMoney(); };

  if (moneyView === 'expenses') renderExpenses(); else renderFinances();
}

function renderExpenses() {
  const rows = sortByDateDesc(DATA.Expenses || []);
  const monthTotal = rows.filter(r => sameMonth(r.Date)).reduce((s, r) => s + num(r.Amount), 0);
  const byCat = {};
  rows.filter(r => sameMonth(r.Date)).forEach(r => { byCat[r.Category] = (byCat[r.Category] || 0) + num(r.Amount); });

  document.getElementById('money-content').innerHTML = `
    <div class="card">
      <h3>Log an expense</h3>
      <form id="form-expense" class="entry-form">
        <label>Date <input type="date" name="Date" value="${todayStr()}" required></label>
        <label>Category
          <select name="Category">${EXPENSE_CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
        </label>
        <label>Description <input type="text" name="Description"></label>
        <label>Amount <input type="number" step="0.01" name="Amount" required></label>
        <label>Method
          <select name="Method">${PAYMENT_METHODS.map(m => `<option>${m}</option>`).join('')}</select>
        </label>
        <button class="btn primary block" type="submit">Add expense</button>
      </form>
    </div>
    <div class="card">
      <h2>This month: ${monthTotal.toFixed(2)}</h2>
      <div class="chart-wrap"><canvas id="chart-expense-cat"></canvas></div>
    </div>
    <div class="card">
      <h2>History</h2>
      ${entryListHtml(rows.map(r => ({ ...r, _sheet: 'Expenses' })), r => ({
        main: `${r.Category}${r.Description ? ' — ' + r.Description : ''}`,
        sub: `${fmtDate(r.Date)} · ${r.Method || ''}`,
        amount: num(r.Amount).toFixed(2)
      }))}
    </div>
  `;
  bindForm('form-expense', 'Expenses', fd => ({
    Date: fd.get('Date'), Category: fd.get('Category'), Description: fd.get('Description'), Amount: fd.get('Amount'), Method: fd.get('Method')
  }));
  bindDeleteButtons();

  destroyChart('chart-expense-cat');
  const labels = Object.keys(byCat);
  const ctx = document.getElementById('chart-expense-cat');
  if (labels.length) {
    charts['chart-expense-cat'] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: labels.map(l => byCat[l]), backgroundColor: palette(labels.length) }] },
      options: { plugins: { legend: { labels: { color: '#cbd5e1' } } } }
    });
  } else {
    ctx.replaceWith(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'No expenses this month' }));
  }
}

function renderFinances() {
  const rows = sortByDateDesc(DATA.Finances || []);
  const thisMonth = rows.filter(r => sameMonth(r.Date));
  const totals = {};
  FINANCE_TYPES.forEach(t => totals[t] = thisMonth.filter(r => r.Type === t).reduce((s, r) => s + num(r.Amount), 0));

  document.getElementById('money-content').innerHTML = `
    <div class="card">
      <h3>Log income / savings / investment</h3>
      <form id="form-finance" class="entry-form">
        <label>Date <input type="date" name="Date" value="${todayStr()}" required></label>
        <label>Type
          <select name="Type">${FINANCE_TYPES.map(t => `<option>${t}</option>`).join('')}</select>
        </label>
        <label>Amount <input type="number" step="0.01" name="Amount" required></label>
        <label>Notes <input type="text" name="Notes"></label>
        <button class="btn primary block" type="submit">Add entry</button>
      </form>
    </div>
    <div class="card">
      <h2>This month by type</h2>
      <div class="stat-grid">
        ${FINANCE_TYPES.map(t => `<div class="stat"><div class="value">${totals[t].toFixed(0)}</div><div class="label">${t}</div></div>`).join('')}
      </div>
    </div>
    <div class="card">
      <h2>History</h2>
      ${entryListHtml(rows.map(r => ({ ...r, _sheet: 'Finances' })), r => ({
        main: r.Type,
        sub: `${fmtDate(r.Date)}${r.Notes ? ' · ' + r.Notes : ''}`,
        amount: num(r.Amount).toFixed(2)
      }))}
    </div>
  `;
  bindForm('form-finance', 'Finances', fd => ({
    Date: fd.get('Date'), Type: fd.get('Type'), Amount: fd.get('Amount'), Notes: fd.get('Notes')
  }));
  bindDeleteButtons();
}

/* ---------- Time ---------- */
function renderTime() {
  const rows = sortByDateDesc(DATA.Time || []);
  const today = rows.filter(r => sameDay(r.Date));
  const byCat = {};
  today.forEach(r => { byCat[r.Category] = (byCat[r.Category] || 0) + num(r.Hours); });

  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="card">
      <h3>Log time</h3>
      <form id="form-time" class="entry-form">
        <label>Date <input type="date" name="Date" value="${todayStr()}" required></label>
        <label>Activity <input type="text" name="Activity" required></label>
        <label>Category
          <select name="Category">${TIME_CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
        </label>
        <label>Hours <input type="number" step="0.25" name="Hours" required></label>
        <label>Notes <input type="text" name="Notes"></label>
        <button class="btn primary block" type="submit">Add entry</button>
      </form>
    </div>
    <div class="card">
      <h2>Today's breakdown</h2>
      <div class="chart-wrap"><canvas id="chart-time-cat"></canvas></div>
    </div>
    <div class="card">
      <h2>History</h2>
      ${entryListHtml(rows.map(r => ({ ...r, _sheet: 'Time' })), r => ({
        main: `${r.Activity} (${r.Category})`,
        sub: `${fmtDate(r.Date)}${r.Notes ? ' · ' + r.Notes : ''}`,
        amount: `${r.Hours}h`
      }))}
    </div>
  `;
  bindForm('form-time', 'Time', fd => ({
    Date: fd.get('Date'), Activity: fd.get('Activity'), Category: fd.get('Category'), Hours: fd.get('Hours'), Notes: fd.get('Notes')
  }));
  bindDeleteButtons();

  destroyChart('chart-time-cat');
  const labels = Object.keys(byCat);
  const ctx = document.getElementById('chart-time-cat');
  if (labels.length) {
    charts['chart-time-cat'] = new Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: labels.map(l => byCat[l]), backgroundColor: palette(labels.length) }] },
      options: { plugins: { legend: { labels: { color: '#cbd5e1' } } } }
    });
  } else {
    ctx.replaceWith(Object.assign(document.createElement('div'), { className: 'empty', textContent: 'No time logged today' }));
  }
}

/* ---------- Init ---------- */
refresh();
