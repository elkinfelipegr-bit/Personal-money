import { parseTransaction } from './parser.js';
import { categoriesFor, findCategory, defaultCategory, PAYMENT_METHODS } from './categories.js';
import * as store from './storage.js';
import { speechSupported, listenOnce } from './speech.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  transactions: store.loadTransactions(),
  settings: store.loadSettings(),
  month: currentMonth(),
  view: 'home',
  filter: 'all',
  search: '',
  editing: null, // movimiento en el diálogo
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

  const recent = sortTx(list).slice(0, 6);
  $('#recent-list').innerHTML = recent.length
    ? recent.map(txItem).join('')
    : '<li class="empty">Dicta o escribe tu primer movimiento arriba.</li>';
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

function renderSettings() {
  $('#currency').value = state.settings.currency;
  const base = new URL('.', location.href).href;
  $('#shortcut-url').textContent = `${base}?q=gasté 20 mil en taxi`;
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

function openDialog(tx, { isNew }) {
  state.editing = { ...tx };
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
  const isNew = !tx.id;
  state.transactions = store.upsertTransaction(tx);
  dialog.close();
  state.month = tx.date.slice(0, 7);
  render();
  const cat = findCategory(tx.category);
  toast(`${isNew ? 'Guardado' : 'Actualizado'}: ${cat.icon} ${money(tx.amount)}`);
}

// ---------------------------------------------------------------------------
// Captura por texto o voz

function capture(text, source) {
  const clean = text.trim();
  if (!clean) return;
  const parsed = parseTransaction(clean);
  openDialog({ ...parsed, source }, { isNew: true });
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
    const item = e.target.closest('.tx[data-id]');
    if (!item) return;
    const tx = state.transactions.find((t) => t.id === item.dataset.id);
    if (tx) openDialog(tx, { isNew: false });
  });

  $$('#tx-form [data-type]').forEach((b) => b.addEventListener('click', () => setDialogType(b.dataset.type)));
  $('#tx-amount').addEventListener('input', (e) => e.target.setCustomValidity(''));
  $('#tx-form').addEventListener('submit', (e) => { e.preventDefault(); saveDialog(); });
  $('#tx-cancel').addEventListener('click', () => dialog.close());
  $('#tx-delete').addEventListener('click', () => {
    const removed = state.editing;
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
    render();
    toast('Se borraron todos los movimientos');
  });
}

function init() {
  bind();
  if (!speechSupported) $('#mic-btn').classList.add('unsupported');
  go('home');
  store.requestPersistence();

  // ?q=texto abre la confirmación directamente (atajos de voz del teléfono).
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || params.get('text');
  if (q) {
    history.replaceState(null, '', location.pathname);
    capture(q, 'atajo');
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
