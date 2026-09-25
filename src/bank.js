// Lector de avisos del banco (SMS, notificaciones o correos) → movimiento.
// Está pensado para los mensajes de bancos colombianos (Bancolombia, Nequi,
// Davivienda, Daviplata, BBVA, Banco de Bogotá…), pero usa reglas generales,
// así que suele funcionar con otros bancos que digan "compraste $X en Y".

import { normalize, parseDigitToken, detectCategory } from './parser.js';

const BANKS = [
  ['bancolombia', 'Bancolombia'], ['nequi', 'Nequi'], ['daviplata', 'Daviplata'],
  ['davivienda', 'Davivienda'], ['bbva', 'BBVA'], ['banco de bogota', 'Banco de Bogotá'],
  ['bogota', 'Banco de Bogotá'], ['scotiabank', 'Scotiabank Colpatria'], ['colpatria', 'Scotiabank Colpatria'],
  ['banco de occidente', 'Banco de Occidente'], ['av villas', 'AV Villas'], ['banco popular', 'Banco Popular'],
  ['falabella', 'Banco Falabella'], ['itau', 'Itaú'], ['nu colombia', 'Nu'], ['nubank', 'Nu'],
  ['lulo', 'Lulo Bank'], ['rappipay', 'RappiPay'], ['movii', 'Movii'], ['banco caja social', 'Caja Social'],
];

// Palabras que delatan que el texto es un aviso automático y no una frase dicha por ti.
const BANK_MARKERS = /\b(le informa|te informa|notifica|aprobad[oa]|t\.?\s?cred|t\.?\s?deb|tarjeta|cuenta|cta|producto)\b|\*\d{3,4}/;

const INCOME_RE = /\b(recibiste|recibio|te (?:enviaron|consignaron|transfirieron|abonaron|llego)|abono|consignacion|pago de nomina|nomina|deposito|reembolso|devolucion|ingreso|te pagaron)\b/;
const EXPENSE_RE = /\b(compraste|compra|pagaste|pago|enviaste|transferiste|transferencia a|retiraste|retiro|debito|cobro|avance|realizaste un pago)\b/;
const WITHDRAWAL_RE = /\b(retiraste|retiro)\b/;

const STOP_AFTER = /\s+(?:con|desde|el|a las|en su|en tu|de su|de tu|hacia|t\.?\s?(?:cred|deb)|tarjeta|cuenta|cta|por valor|por)\b|\s+\d{1,2}[/:-]|[,;]\s|\.\s|\.$|\s+\*|\s*$/i;

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function findAmount(text) {
  const m = /(?:\$|\bcop\b)\s?(\d[\d.,]*\d|\d)/i.exec(text);
  if (!m) return null;
  const value = parseDigitToken(m[1]);
  return value ? { value, index: m.index, end: m.index + m[0].length } : null;
}

function findDate(text, now) {
  let m = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/.exec(text);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
    if (d.getMonth() === Number(m[2]) - 1 && d <= now) return isoDate(d);
  }
  m = /\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/.exec(text);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getMonth() === Number(m[2]) - 1 && d <= now) return isoDate(d);
  }
  return isoDate(now);
}

function titleCase(s) {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, sp, c) => sp + c.toUpperCase());
}

function cleanMerchant(s) {
  const out = s
    .replace(/\*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^(?:la|el|los|las)\s+/i, '')
    .trim();
  if (!out || /^(su|tu|sus|tus)\b/i.test(out) || out.length < 2) return '';
  return titleCase(out).slice(0, 60);
}

function findMerchant(text, amount) {
  // Después del monto: "$25.000 en RAPPI*RESTAURANTE con tu T.Cred"
  const after = text.slice(amount.end).replace(/^,\d{2}\b/, '');
  const m = /^\s*(?:en|a|de|al|para)\s+(.+)/i.exec(after);
  if (m) {
    const stop = STOP_AFTER.exec(m[1]);
    const merchant = cleanMerchant(stop ? m[1].slice(0, stop.index) : m[1]);
    if (merchant) return merchant;
  }
  // Antes del monto: "Compra aprobada en EXITO por $25.000"
  const before = text.slice(0, amount.index);
  const b = /.*\b(?:en|a|de)\s+([^\s].{1,50}?)\s+(?:por|por valor de|valor)\s*$/i.exec(before);
  if (b) return cleanMerchant(b[1]);
  return '';
}

function findPayment(norm, bank) {
  if (/t\.?\s?cred|tarjeta de credito|\btc\b|credito/.test(norm)) return 'credito';
  if (/t\.?\s?deb|tarjeta debito|tarjeta de debito|\btd\b/.test(norm)) return 'debito';
  if (bank === 'Nequi') return 'nequi';
  if (bank === 'Daviplata') return 'daviplata';
  if (/transferencia|transferiste|enviaste|te enviaron|pse/.test(norm)) return 'transferencia';
  return null;
}

/** Devuelve el movimiento, o null si el texto no parece un aviso bancario. */
export function parseBankMessage(text, now = new Date()) {
  const raw = text.trim();
  const norm = normalize(raw);
  const amount = findAmount(raw);
  if (!amount) return null;

  const bank = BANKS.find(([key]) => norm.includes(key))?.[1] ?? null;
  const income = INCOME_RE.exec(norm);
  const expense = EXPENSE_RE.exec(norm);
  if (!bank && !((income || expense) && BANK_MARKERS.test(norm))) return null;

  let type = 'expense';
  if (income && (!expense || income.index <= expense.index)) type = 'income';

  const merchant = findMerchant(raw, amount);
  const withdrawal = type === 'expense' && WITHDRAWAL_RE.test(norm);
  let description = merchant;
  if (withdrawal) description = 'Retiro de efectivo';
  if (!description) description = type === 'income' ? 'Dinero recibido' : 'Compra';

  const words = normalize(type === 'income' ? raw : merchant).split(/[^a-z0-9ñ]+/).filter(Boolean);
  const category = detectCategory(words, type);

  return {
    type,
    amount: amount.value,
    category,
    description,
    date: findDate(raw, now),
    paymentMethod: withdrawal ? 'efectivo' : findPayment(norm, bank),
    raw,
    bank,
  };
}

/**
 * Lee varios avisos pegados juntos (uno por línea o separados por líneas en blanco).
 * Las líneas sin monto se unen a la anterior (correos de varias líneas).
 */
export function parseBankBatch(text, now = new Date()) {
  const chunks = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) { chunks.push(''); continue; }
    const last = chunks.length ? chunks[chunks.length - 1] : '';
    if (last && !findAmount(trimmed)) chunks[chunks.length - 1] = `${last} ${trimmed}`;
    else if (last && !findAmount(last)) chunks[chunks.length - 1] = `${last} ${trimmed}`;
    else chunks.push(trimmed);
  }
  return chunks.filter(Boolean).map((c) => parseBankMessage(c, now)).filter(Boolean);
}

/** Huella para no importar dos veces el mismo aviso. */
export function messageKey(raw) {
  return normalize(raw).replace(/\s+/g, ' ').trim();
}
