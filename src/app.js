import { parseTransaction, parseMany } from './parser.js';
import { parseBankMessage, parseBankBatch, messageKey } from './bank.js';
import { dueRecurring, budgetStatus, monthlyTrend, levelFor, monthOf } from './planning.js';
import { categoriesFor, findCategory, defaultCategory, PAYMENT_METHODS, EXPENSE_CATEGORIES } from './categories.js';
import * as store from './storage.js';
import { speechSupported, listenOnce } from './speech.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  transactions: store.loadTransactions(),
  pending: store.loadPending(),
  recurring: store.loadRecurring(),
  settings: store.loadSettings(),
  month: currentMonth(),
  view: 'home',
  filter: 'all',
  search: '',
  editing: null, // movimiento en el diálogo
  editingPendingId: null, // si el diálogo viene de la bandeja "por revisar"
};

// ---------------------------------------------------------------------------
// Utilidades

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function money(value, { sign = false } = {}) {
  const { currency, locale } = state.settings;
  const decimals = ['COP', 'CLP'].includes(currency) ? 0 : 2;
  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: decimals,
  });
  const text = fmt.format(Math.abs(value));
  if (!sign) return value < 0 ? `-${text}` : text;
  return `${value < 0 ? '−' : '+'}${text}`;
}

function monthName(month) {
  const [y, m] = month.split('-').map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function dayLabel(iso) {
  if (iso === todayISO()) return 'Hoy';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const [yy, mm, dd] = iso.split('-').map(Number);
  const d = new Date(yy, mm - 1, dd);
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  const label = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseAmountInput(text) {
  const parsed = parseTransaction(String(text));
  return parsed.amount;
}

function monthTx(month = state.month) {
  return state.transactions.filter((t) => t.date.startsWith(month));
}

function totals(list) {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

// ---------------------------------------------------------------------------
// Render

function txItem(t) {
  const cat = findCategory(t.category);
  const sign = t.type === 'income' ? 1 : -1;
  const pay = PAYMENT_METHODS.find((p) => p.id === t.paymentMethod);
  return `
    <li>
      <button type="button" class="tx" data-id="${t.id}">
        <span class="tx-icon" aria-hidden="true">${cat.icon}</span>
        <span class="tx-main">
          <span class="tx-desc">${escapeHTML(t.description || cat.name)}</span>
          <span class="tx-meta">${escapeHTML(cat.name)}${pay ? ` · ${pay.name}` : ''}</span>
        </span>
        <span class="tx-amount ${t.type}">${money(sign * t.amount, { sign: true })}</span>
      </button>
    </li>`;
}

function sortTx(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

function renderHome() {
  const list = monthTx();
  const { income, expense, balance } = totals(list);
  $('#balance-total').textContent = money(balance);
  $('#balance-total').className = `hero ${balance < 0 ? 'expense' : ''}`;
  $('#income-total').textContent = money(income);
  $('#expense-total').textContent = money(expense);

  let hint = '';
  if (!list.length) hint = 'Aún no hay movimientos este mes.';
  else if (income > 0) {
    const pct = Math.round((expense / income) * 100);
    hint = `Has gastado el ${pct} % de lo que ha entrado este mes.`;
  }
  $('#balance-hint').textContent = hint;

  renderBudgetAlerts();
  renderPending();

  const recent = sortTx(list).slice(0, 6);
  $('#recent-list').innerHTML = recent.length
    ? recent.map(txItem).join('')
    : '<li class="empty">Dicta o escribe tu primer movimiento arriba.</li>';
}

function monthLabelShort(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es', { month: 'short' }).replace('.', '');
}

function renderBudgetAlerts() {
  const alerts = budgetStatus(state.settings.budgets, state.transactions, state.month)
    .filter((b) => b.level === 'warn' || b.level === 'over');
  $('#budget-alerts').innerHTML = alerts.map((b) => {
    const c = findCategory(b.category);
    const text = b.level === 'over'
      ? `Te pasaste en ${escapeHTML(c.name)}: ${money(b.spent)} de ${money(b.budget)}`
      : `${escapeHTML(c.name)} va en ${b.pct} % del presupuesto (${money(b.budget - b.spent)} disponibles)`;
    return `<li class="alert ${b.level}"><span aria-hidden="true">${b.level === 'over' ? '⛔' : '⚠️'}</span> ${text}</li>`;
  }).join('');
}

function renderPending() {
  const list = [...state.pending].sort((a, b) => a.date.localeCompare(b.date));
  $('#pending-card').hidden = !list.length;
  $('#pending-count').textContent = list.length;
  $('#pending-list').innerHTML = list.map((t) => {
    const cat = findCategory(t.category);
    const sign = t.type === 'income' ? 1 : -1;
    const origin = t.bank ?? (t.source === 'recurrente' ? 'Fijo del mes' : 'Frase');
    return `
      <li class="pending-item">
        <button type="button" class="tx" data-pending="${t.id}" aria-label="Revisar ${escapeHTML(t.description || cat.name)}">
          <span class="tx-icon" aria-hidden="true">${cat.icon}</span>
          <span class="tx-main">
            <span class="tx-desc">${escapeHTML(t.description || cat.name)}</span>
            <span class="tx-meta">${escapeHTML(origin)} · ${dayLabel(t.date)} · ${escapeHTML(cat.name)}</span>
          </span>
          <span class="tx-amount ${t.type}">${t.amount ? money(sign * t.amount, { sign: true }) : '¿?'}</span>
        </button>
        <span class="pending-actions">
          <button type="button" class="round ok" data-accept="${t.id}" aria-label="Aceptar">✓</button>
          <button type="button" class="round" data-discard="${t.id}" aria-label="Descartar">✕</button>
        </span>
      </li>`;
  }).join('');
}

function renderList() {
  const q = state.search.trim().toLowerCase();
  const list = sortTx(monthTx()).filter((t) => {
    if (state.filter !== 'all' && t.type !== state.filter) return false;
    if (!q) return true;
    const cat = findCategory(t.category).name;
    return `${t.description} ${cat} ${t.raw ?? ''}`.toLowerCase().includes(q);
  });
  if (!list.length) {
    $('#full-list').innerHTML = '<p class="empty">No hay movimientos para mostrar.</p>';
    return;
  }
  const byDay = new Map();
  for (const t of list) {
    if (!byDay.has(t.date)) byDay.set(t.date, []);
    byDay.get(t.date).push(t);
  }
  $('#full-list').innerHTML = [...byDay.entries()].map(([day, items]) => {
    const net = totals(items).balance;
    return `
      <div class="day">
        <div class="day-head"><span>${dayLabel(day)}</span><span class="muted">${money(net, { sign: true })}</span></div>
        <ul class="tx-list">${items.map(txItem).join('')}</ul>
      </div>`;
  }).join('');
}

function bars(container, rows, total, kind) {
  if (!rows.length) {
    container.innerHTML = '<p class="empty">Sin datos este mes.</p>';
    return;
  }
  const max = Math.max(...rows.map((r) => r.value));
  container.innerHTML = rows.map((r) => {
    const pct = total ? Math.round((r.value / total) * 100) : 0;
    const width = max ? Math.max(2, (r.value / max) * 100) : 0;
    return `
      <div class="bar-row" title="${escapeHTML(r.label)}: ${money(r.value)} (${pct} %)">
        <span class="bar-label">${r.icon ? `${r.icon} ` : ''}${escapeHTML(r.label)}</span>
        <span class="bar-value">${money(r.value)} <span class="muted">${pct} %</span></span>
        <span class="bar-track"><span class="bar-fill ${kind}" style="width:${width}%"></span></span>
      </div>`;
  }).join('');
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const t of list) {
    const k = keyFn(t);
    map.set(k, (map.get(k) ?? 0) + t.amount);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderSummary() {
  const list = monthTx();
  const { income, expense, balance } = totals(list);
  const expenses = list.filter((t) => t.type === 'expense');
  const incomes = list.filter((t) => t.type === 'income');

  $('#savings-rate').textContent = income > 0 ? `${Math.round((balance / income) * 100)} %` : '–';

  const [y, m] = state.month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const elapsed = state.month === currentMonth() ? new Date().getDate() : daysInMonth;
  $('#daily-avg').textContent = expense > 0 ? money(Math.round(expense / elapsed)) : '–';

  const prev = totals(monthTx(shiftMonth(state.month, -1))).expense;
  if (prev > 0 && expense > 0) {
    const diff = Math.round(((expense - prev) / prev) * 100);
    $('#vs-prev').textContent = `${diff > 0 ? '+' : ''}${diff} % gasto`;
  } else $('#vs-prev').textContent = '–';

  renderTrend();
  const budgets = budgetStatus(state.settings.budgets, state.transactions, state.month);
  $('#budgets-summary-card').hidden = !budgets.length;
  $('#budget-bars').innerHTML = budgets.map((b) => {
    const c = findCategory(b.category);
    const width = b.spent > 0 ? Math.min(100, Math.max(2, b.pct)) : 0;
    return `
      <div class="bar-row" title="${escapeHTML(c.name)}: ${money(b.spent)} de ${money(b.budget)}">
        <span class="bar-label">${c.icon} ${escapeHTML(c.name)}</span>
        <span class="bar-value">${money(b.spent)} <span class="muted">de ${money(b.budget)}</span></span>
        <span class="bar-track"><span class="bar-fill budget-${b.level}" style="width:${width}%"></span></span>
        <span class="bar-note ${b.level}">${b.level === 'over' ? `⛔ Excedido en ${money(b.spent - b.budget)}` : b.level === 'warn' ? `⚠️ ${b.pct} % usado` : `${b.pct} % usado`}</span>
      </div>`;
  }).join('');

  const catRows = (items) => groupBy(items, (t) => t.category).map(([id, value]) => {
    const c = findCategory(id);
    return { label: c.name, icon: c.icon, value };
  });
  bars($('#expense-bars'), catRows(expenses), expense, 'expense');
  bars($('#income-bars'), catRows(incomes), income, 'income');
  bars($('#payment-bars'),
    groupBy(expenses, (t) => t.paymentMethod ?? 'sin').map(([id, value]) => ({
      label: PAYMENT_METHODS.find((p) => p.id === id)?.name ?? 'Sin especificar', value,
    })),
    expense, 'neutral');
}

function renderTrend() {
  const rows = monthlyTrend(state.transactions, state.month, 6);
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  $('#trend-chart').innerHTML = rows.map((r) => {
    const h = (v) => (v > 0 ? Math.max(2, (v / max) * 100) : 0);
    const active = r.month === state.month ? ' active' : '';
    return `
      <div class="trend-col${active}">
        <div class="trend-bars">
          <span class="trend-bar income" style="height:${h(r.income)}%" title="Ingresos ${monthName(r.month)}: ${money(r.income)}"></span>
          <span class="trend-bar expense" style="height:${h(r.expense)}%" title="Gastos ${monthName(r.month)}: ${money(r.expense)}"></span>
        </div>
        <span class="trend-label">${monthLabelShort(r.month)}</span>
      </div>`;
  }).join('');
  $('#trend-table').innerHTML = `
    <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${monthName(r.month)}</td><td>${money(r.income)}</td><td>${money(r.expense)}</td><td>${money(r.income - r.expense)}</td></tr>`).join('')}</tbody>`;
}

function renderBudgetsForm() {
  const budgets = state.settings.budgets ?? {};
  $('#budgets-form').innerHTML = EXPENSE_CATEGORIES.map((c) => `
    <label class="budget-field">
      <span>${c.icon} ${c.name}</span>
      <input type="text" inputmode="numeric" data-budget="${c.id}" placeholder="Sin límite"
             value="${budgets[c.id] ? budgets[c.id].toLocaleString(state.settings.locale) : ''}">
    </label>`).join('');
}

function renderRecurring() {
  $('#recurring-list').innerHTML = state.recurring.length
    ? state.recurring.map((r) => {
      const c = findCategory(r.category);
      return `
        <li class="pending-item">
          <span class="tx static">
            <span class="tx-icon" aria-hidden="true">${c.icon}</span>
            <span class="tx-main">
              <span class="tx-desc">${escapeHTML(r.description || c.name)}</span>
              <span class="tx-meta">Cada mes el día ${r.day} · ${escapeHTML(c.name)}</span>
            </span>
            <span class="tx-amount ${r.type}">${money((r.type === 'income' ? 1 : -1) * r.amount, { sign: true })}</span>
          </span>
          <span class="pending-actions">
            <button type="button" class="round" data-unrepeat="${r.id}" aria-label="Dejar de repetir">✕</button>
          </span>
        </li>`;
    }).join('')
    : '<li class="empty">Aún no tienes gastos o ingresos fijos.</li>';
}

function renderSettings() {
  renderBudgetsForm();
  renderRecurring();
  $('#currency').value = state.settings.currency;
  const base = new URL('.', location.href).href;
  $('#shortcut-url').textContent = window.top === window
    ? `${base}?text=gasté 20 mil en taxi`
    : 'Disponible cuando abras la app desde su dirección de GitHub Pages.';
}

function render() {
  $('#month-label').textContent = monthName(state.month);
  $('#next-month').disabled = state.month >= currentMonth();
  if (state.view === 'home') renderHome();
  if (state.view === 'list') renderList();
  if (state.view === 'summary') renderSummary();
  if (state.view === 'settings') renderSettings();
}

// ---------------------------------------------------------------------------
// Navegación

function go(view) {
  state.view = view;
  for (const s of $$('.view')) s.hidden = s.dataset.view !== view;
  for (const b of $$('.tabbar button')) {
    if (b.dataset.tab === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  $('#add-manual').hidden = view === 'settings';
  render();
  window.scrollTo({ top: 0 });
}

// ---------------------------------------------------------------------------
// Diálogo de confirmación / edición

const dialog = $('#tx-dialog');

function setDialogType(type) {
  state.editing.type = type;
  for (const b of $$('#tx-form [data-type]')) b.setAttribute('aria-checked', String(b.dataset.type === type));
  const select = $('#tx-category');
  const current = select.value;
  select.innerHTML = categoriesFor(type).map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  const valid = categoriesFor(type).some((c) => c.id === current);
  select.value = valid ? current : (state.editing.category && categoriesFor(type).some((c) => c.id === state.editing.category)
    ? state.editing.category : defaultCategory(type));
  $('#tx-save').textContent = type === 'income' ? 'Guardar ingreso' : 'Guardar gasto';
}

function openDialog(tx, { isNew, pendingId = null }) {
  state.editing = { ...tx };
  state.editingPendingId = pendingId;
  $('#tx-repeat').checked = false;
  $('#tx-repeat').closest('label').hidden = tx.source === 'recurrente';
  $('#tx-title').textContent = isNew ? 'Confirmar movimiento' : 'Editar movimiento';
  $('#tx-raw').textContent = tx.raw ? `«${tx.raw}»` : '';
  $('#tx-raw').hidden = !tx.raw;
  $('#tx-amount').value = tx.amount ? tx.amount.toLocaleString(state.settings.locale) : '';
  $('#tx-description').value = tx.description ?? '';
  $('#tx-date').value = tx.date ?? todayISO();
  $('#tx-payment').innerHTML = '<option value="">Sin especificar</option>'
    + PAYMENT_METHODS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  $('#tx-payment').value = tx.paymentMethod ?? '';
  $('#tx-category').innerHTML = '';
  setDialogType(tx.type ?? 'expense');
  $('#tx-category').value = tx.category ?? defaultCategory(tx.type ?? 'expense');
  $('#tx-delete').hidden = isNew;
  dialog.showModal();
  if (!tx.amount) $('#tx-amount').focus();
}

function saveDialog() {
  const amount = parseAmountInput($('#tx-amount').value);
  if (!amount || amount <= 0) {
    $('#tx-amount').setCustomValidity('Escribe un monto válido');
    $('#tx-amount').reportValidity();
    return;
  }
  const tx = {
    ...state.editing,
    amount,
    description: $('#tx-description').value.trim(),
    category: $('#tx-category').value,
    date: $('#tx-date').value || todayISO(),
    paymentMethod: $('#tx-payment').value || null,
  };
  const fromPending = state.editingPendingId;
  const isNew = !tx.id || Boolean(fromPending);
  if ($('#tx-repeat').checked) addRecurringFrom(tx);
  commitTransaction(tx, { fromPending });
  dialog.close();
  if (!fromPending) state.month = tx.date.slice(0, 7);
  render();
  const cat = findCategory(tx.category);
  const alert = budgetAlertFor(tx);
  toast(alert ?? `${isNew ? 'Guardado' : 'Actualizado'}: ${cat.icon} ${money(tx.amount)}`);
}

// Guarda un movimiento (nuevo o editado) y lo saca de la bandeja si venía de ahí.
function commitTransaction(tx, { fromPending = null } = {}) {
  const clean = { ...tx };
  delete clean.pendingAt;
  delete clean.bank;
  if (fromPending) {
    delete clean.id;
    state.pending = store.removePending(fromPending);
    if (tx.raw && tx.bank) store.markSeen([messageKey(tx.raw)]);
  }
  state.transactions = store.upsertTransaction(clean);
}

function addRecurringFrom(tx) {
  const rule = {
    id: store.newId(),
    type: tx.type,
    amount: tx.amount,
    category: tx.category,
    description: tx.description,
    paymentMethod: tx.paymentMethod ?? null,
    day: Number(tx.date.slice(8, 10)),
    lastMonth: monthOf(tx.date),
  };
  state.recurring = [...state.recurring, rule];
  store.saveRecurring(state.recurring);
}

// Mensaje si este gasto hizo cruzar el 80 % o el 100 % del presupuesto.
function budgetAlertFor(tx) {
  const budget = state.settings.budgets?.[tx.category];
  if (tx.type !== 'expense' || !budget) return null;
  const month = monthOf(tx.date);
  const spent = state.transactions
    .filter((t) => t.type === 'expense' && t.category === tx.category && monthOf(t.date) === month)
    .reduce((sum, t) => sum + t.amount, 0);
  const before = levelFor(spent - tx.amount, budget);
  const after = levelFor(spent, budget);
  if (after === before || after === 'ok') return null;
  const c = findCategory(tx.category);
  return after === 'over'
    ? `⛔ Te pasaste del presupuesto de ${c.name} (${money(spent)} de ${money(budget)})`
    : `⚠️ Ya usaste el ${Math.round((spent / budget) * 100)} % del presupuesto de ${c.name}`;
}

function acceptPending(id) {
  const item = state.pending.find((p) => p.id === id);
  if (!item) return;
  if (!item.amount) {
    openDialog(item, { isNew: true, pendingId: id });
    return;
  }
  commitTransaction(item, { fromPending: id });
  render();
  toast(budgetAlertFor(item) ?? `Guardado: ${findCategory(item.category).icon} ${money(item.amount)}`);
}

function queuePending(items, message) {
  state.pending = store.addPending(items);
  go('home');
  toast(message);
  $('#pending-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Genera en la bandeja los fijos del mes que ya tocan.
function processRecurring() {
  const due = dueRecurring(state.recurring);
  if (!due.length) return;
  state.pending = store.addPending(due.map((d) => d.tx));
  const last = new Map();
  for (const d of due) last.set(d.ruleId, d.month);
  state.recurring = state.recurring.map((r) => (last.has(r.id) ? { ...r, lastMonth: last.get(r.id) } : r));
  store.saveRecurring(state.recurring);
}

// ---------------------------------------------------------------------------
// Captura por texto o voz

function capture(text, source) {
  const clean = text.trim();
  if (!clean) return;

  // ¿Es un aviso del banco (o varios pegados)?
  const bankItems = parseBankBatch(clean);
  if (bankItems.length > 1) {
    importBankItems(bankItems);
    return;
  }
  const single = bankItems[0] ?? parseBankMessage(clean);
  if (single) {
    const repeated = store.loadSeen().has(messageKey(single.raw));
    openDialog({ ...single, source: 'banco' }, { isNew: true });
    if (repeated) toast('Ojo: este aviso ya lo habías registrado');
    return;
  }

  const items = parseMany(clean);
  if (items.length === 1) {
    openDialog({ ...items[0], source }, { isNew: true });
    return;
  }
  queuePending(items.map((t) => ({ ...t, source })), `Encontré ${items.length} movimientos. Revísalos abajo.`);
}

function importBankItems(items) {
  const seen = store.loadSeen();
  const fresh = [];
  const keys = new Set();
  for (const item of items) {
    const key = messageKey(item.raw);
    if (seen.has(key) || keys.has(key)) continue;
    keys.add(key);
    fresh.push({ ...item, source: 'banco' });
  }
  const skipped = items.length - fresh.length;
  if (!fresh.length) {
    toast('Esos avisos ya estaban registrados');
    return 0;
  }
  store.markSeen([...keys]);
  queuePending(fresh, `${fresh.length} aviso${fresh.length > 1 ? 's' : ''} por revisar${skipped ? ` (${skipped} repetido${skipped > 1 ? 's' : ''})` : ''}`);
  return fresh.length;
}

let listening = null;

async function toggleMic() {
  const btn = $('#mic-btn');
  const out = $('#transcript');
  if (listening) {
    listening.stop();
    return;
  }
  if (!speechSupported) {
    out.textContent = 'Tu navegador no permite dictado aquí. Usa el micrófono del teclado en el campo de texto.';
    $('#quick-input').focus();
    return;
  }
  btn.classList.add('listening');
  out.textContent = 'Te escucho…';
  listening = listenOnce({
    lang: state.settings.locale,
    onInterim: (t) => { out.textContent = t || 'Te escucho…'; },
  });
  try {
    const text = await listening.promise;
    if (text) {
      out.textContent = `«${text}»`;
      capture(text, 'voz');
    } else {
      out.textContent = 'No te entendí. Intenta de nuevo o escríbelo.';
    }
  } catch (err) {
    out.textContent = err.message === 'not-allowed'
      ? 'Necesito permiso para usar el micrófono.'
      : 'No se pudo usar el micrófono. Escríbelo abajo.';
  } finally {
    btn.classList.remove('listening');
    listening = null;
  }
}

// ---------------------------------------------------------------------------
// Avisos

let toastTimer;
function toast(text, action) {
  const el = $('#toast');
  $('#toast-text').textContent = text;
  const btn = $('#toast-action');
  btn.hidden = !action;
  btn.onclick = action ? () => { action(); el.hidden = true; } : null;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 3000);
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------------------
// Eventos

function bind() {
  $$('.tabbar button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => go(b.dataset.goto)));
  $('#prev-month').addEventListener('click', () => { state.month = shiftMonth(state.month, -1); render(); });
  $('#next-month').addEventListener('click', () => { state.month = shiftMonth(state.month, 1); render(); });

  $('#mic-btn').addEventListener('click', toggleMic);
  $('#quick-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#quick-input');
    capture(input.value, 'texto');
    input.value = '';
  });
  $$('#examples .chip').forEach((c) => c.addEventListener('click', () => capture(c.textContent, 'texto')));
  $('#add-manual').addEventListener('click', () => openDialog({ type: 'expense', date: todayISO(), source: 'manual' }, { isNew: true }));

  document.body.addEventListener('click', (e) => {
    const accept = e.target.closest('[data-accept]');
    if (accept) { acceptPending(accept.dataset.accept); return; }
    const discard = e.target.closest('[data-discard]');
    if (discard) {
      const removed = state.pending.find((p) => p.id === discard.dataset.discard);
      state.pending = store.removePending(discard.dataset.discard);
      render();
      toast('Descartado', () => { state.pending = store.addPending([removed]); render(); });
      return;
    }
    const unrepeat = e.target.closest('[data-unrepeat]');
    if (unrepeat) {
      state.recurring = state.recurring.filter((r) => r.id !== unrepeat.dataset.unrepeat);
      store.saveRecurring(state.recurring);
      renderRecurring();
      toast('Ya no se repetirá');
      return;
    }
    const pending = e.target.closest('.tx[data-pending]');
    if (pending) {
      const item = state.pending.find((p) => p.id === pending.dataset.pending);
      if (item) openDialog(item, { isNew: true, pendingId: item.id });
      return;
    }
    const item = e.target.closest('.tx[data-id]');
    if (!item) return;
    const tx = state.transactions.find((t) => t.id === item.dataset.id);
    if (tx) openDialog(tx, { isNew: false });
  });

  $('#accept-all').addEventListener('click', () => {
    const ready = state.pending.filter((p) => p.amount);
    for (const item of ready) commitTransaction(item, { fromPending: item.id });
    render();
    toast(`${ready.length} movimiento${ready.length === 1 ? '' : 's'} guardado${ready.length === 1 ? '' : 's'}`);
  });

  const pasteDialog = $('#paste-dialog');
  $('#open-paste').addEventListener('click', () => {
    $('#paste-text').value = '';
    $('#paste-result').textContent = '';
    pasteDialog.showModal();
    $('#paste-text').focus();
  });
  $('#paste-cancel').addEventListener('click', () => pasteDialog.close());
  $('#paste-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const items = parseBankBatch($('#paste-text').value);
    if (!items.length) {
      $('#paste-result').textContent = 'No reconocí avisos del banco. Deben incluir el monto con $ (p. ej. «Compraste $25.000 en…»).';
      return;
    }
    pasteDialog.close();
    importBankItems(items);
  });

  $('#budgets-form').addEventListener('change', (e) => {
    const input = e.target.closest('[data-budget]');
    if (!input) return;
    const value = parseAmountInput(input.value);
    const budgets = { ...(state.settings.budgets ?? {}) };
    if (value && value > 0) budgets[input.dataset.budget] = value;
    else delete budgets[input.dataset.budget];
    state.settings.budgets = budgets;
    store.saveSettings(state.settings);
    input.value = value ? value.toLocaleString(state.settings.locale) : '';
    toast('Presupuesto guardado');
  });

  $$('#tx-form [data-type]').forEach((b) => b.addEventListener('click', () => setDialogType(b.dataset.type)));
  $('#tx-amount').addEventListener('input', (e) => e.target.setCustomValidity(''));
  $('#tx-form').addEventListener('submit', (e) => { e.preventDefault(); saveDialog(); });
  $('#tx-cancel').addEventListener('click', () => dialog.close());
  $('#tx-delete').addEventListener('click', () => {
    const removed = state.editing;
    if (!removed.id) return;
    state.transactions = store.deleteTransaction(removed.id);
    dialog.close();
    render();
    toast('Movimiento eliminado', () => {
      state.transactions = store.upsertTransaction(removed);
      render();
    });
  });

  $$('#view-list [data-filter]').forEach((b) => b.addEventListener('click', () => {
    state.filter = b.dataset.filter;
    $$('#view-list [data-filter]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    renderList();
  }));
  $('#search').addEventListener('input', (e) => { state.search = e.target.value; renderList(); });

  $('#currency').addEventListener('change', (e) => {
    state.settings.currency = e.target.value;
    store.saveSettings(state.settings);
    toast('Moneda actualizada');
  });
  $('#export-csv').addEventListener('click', () => {
    download(`mi-plata-${todayISO()}.csv`, `﻿${store.toCSV(state.transactions)}`, 'text/csv;charset=utf-8');
  });
  $('#export-json').addEventListener('click', () => {
    download(`mi-plata-respaldo-${todayISO()}.json`, store.exportBackup(), 'application/json');
  });
  $('#import-json').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = store.importBackup(await file.text());
      state.transactions = store.loadTransactions();
      state.settings = store.loadSettings();
      state.recurring = store.loadRecurring();
      render();
      toast(`Respaldo restaurado (${count} movimientos)`);
    } catch (err) {
      toast(err.message);
    }
    e.target.value = '';
  });
  $('#clear-all').addEventListener('click', () => {
    if (!confirm('¿Borrar todos los movimientos? Esto no se puede deshacer.')) return;
    store.clearAll();
    state.transactions = [];
    state.pending = [];
    render();
    toast('Se borraron todos los movimientos');
  });
}

function init() {
  bind();
  processRecurring();
  if (!speechSupported) $('#mic-btn').classList.add('unsupported');
  go('home');
  store.requestPersistence();

  // ?q=texto abre la confirmación directamente (atajos de voz del teléfono).
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || params.get('text') || params.get('title');
  if (q) {
    history.replaceState(null, '', location.pathname);
    capture(q, 'atajo');
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
