// Persistencia local (en el propio dispositivo). Todo pasa por este módulo,
// así que más adelante se puede cambiar por una base de datos en la nube
// sin tocar la interfaz.

const TX_KEY = 'pm.transactions.v1';
const SETTINGS_KEY = 'pm.settings.v1';
const PENDING_KEY = 'pm.pending.v1';
const RECURRING_KEY = 'pm.recurring.v1';
const SEEN_KEY = 'pm.seen.v1';

const DEFAULT_SETTINGS = { currency: 'COP', locale: 'es-CO', budgets: {} };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadTransactions() {
  return read(TX_KEY, []);
}

export function saveTransactions(list) {
  write(TX_KEY, list);
}

export function upsertTransaction(tx) {
  const list = loadTransactions();
  const idx = list.findIndex((t) => t.id === tx.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...tx, updatedAt: new Date().toISOString() };
  else list.push({ ...tx, id: tx.id ?? newId(), createdAt: new Date().toISOString() });
  saveTransactions(list);
  return list;
}

export function deleteTransaction(id) {
  const list = loadTransactions().filter((t) => t.id !== id);
  saveTransactions(list);
  return list;
}

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...read(SETTINGS_KEY, {}) };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

// Bandeja "por revisar": avisos del banco, recurrentes y frases con varios movimientos.
export function loadPending() {
  return read(PENDING_KEY, []);
}

export function savePending(list) {
  write(PENDING_KEY, list);
}

export function addPending(items) {
  const list = loadPending();
  for (const item of items) list.push({ ...item, id: newId(), pendingAt: new Date().toISOString() });
  savePending(list);
  return list;
}

export function removePending(id) {
  const list = loadPending().filter((p) => p.id !== id);
  savePending(list);
  return list;
}

export function loadRecurring() {
  return read(RECURRING_KEY, []);
}

export function saveRecurring(list) {
  write(RECURRING_KEY, list);
}

// Huellas de avisos ya importados, para no duplicarlos (se guardan las 1000 últimas).
export function loadSeen() {
  return new Set(read(SEEN_KEY, []));
}

export function markSeen(keys) {
  const all = [...loadSeen(), ...keys];
  write(SEEN_KEY, [...new Set(all)].slice(-1000));
}

export function exportBackup() {
  return JSON.stringify({
    app: 'personal-money',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    transactions: loadTransactions(),
    recurring: loadRecurring(),
  }, null, 2);
}

// Combina un respaldo con los datos actuales (no borra nada; los id repetidos se sobrescriben).
export function importBackup(json) {
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.transactions)) throw new Error('El archivo no es un respaldo válido.');
  const byId = new Map(loadTransactions().map((t) => [t.id, t]));
  for (const t of data.transactions) {
    if (typeof t.amount !== 'number' || !t.date || !t.type) continue;
    byId.set(t.id ?? newId(), { ...t, id: t.id ?? newId() });
  }
  const list = [...byId.values()];
  saveTransactions(list);
  if (data.settings) saveSettings({ ...loadSettings(), ...data.settings });
  if (Array.isArray(data.recurring)) {
    const rules = new Map(loadRecurring().map((r) => [r.id, r]));
    for (const r of data.recurring) if (r.id) rules.set(r.id, r);
    saveRecurring([...rules.values()]);
  }
  return list.length;
}

export function toCSV(list) {
  const header = ['fecha', 'tipo', 'monto', 'categoria', 'descripcion', 'medio_de_pago'];
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [...list]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [t.date, t.type === 'income' ? 'ingreso' : 'gasto', t.amount, t.category, t.description, t.paymentMethod ?? '']
      .map(esc).join(','));
  return [header.join(','), ...rows].join('\n');
}

export function clearAll() {
  localStorage.removeItem(TX_KEY);
  localStorage.removeItem(PENDING_KEY);
}

// Pide al navegador que no borre los datos si el teléfono se queda sin espacio.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch { /* opcional */ }
}
