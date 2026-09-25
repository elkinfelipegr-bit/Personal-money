// Intérprete de frases en español ("gasté 25 mil en almuerzo", "me pagaron
// la quincena 1,2 millones") → movimiento estructurado. Es 100 % local:
// no envía nada a internet y funciona sin conexión.

import { categoriesFor, defaultCategory } from './categories.js';

export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// ---------------------------------------------------------------------------
// Números

const UNITS = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21,
  veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300,
  trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800,
  ochocientas: 800, novecientos: 900, novecientas: 900,
};

// "lucas" = miles y "palos" = millones en el habla colombiana.
const THOUSANDS = new Set(['mil', 'k', 'luca', 'lucas', 'barras']);
const MILLIONS = new Set(['millon', 'millones', 'palo', 'palos', 'melones', 'mill']);
const ARTICLES = new Set(['un', 'una', 'uno']);

// "25.000", "1.500.000", "25,000" → separadores de miles; "1,5" o "12.50" → decimales.
export function parseDigitToken(token) {
  let t = token.replace(/^\$/, '');
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t)) return Number(t.replace(/,/g, ''));
  if (/^\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  return null;
}

function wordValue(word) {
  if (word in UNITS) return UNITS[word];
  return parseDigitToken(word);
}

function isNumberish(word) {
  return wordValue(word) !== null || THOUSANDS.has(word) || MILLIONS.has(word) || word === 'medio';
}

// Encuentra todas las cifras de la frase. Devuelve [{start, end, value, strong}].
// "strong" indica que la cifra tiene dígitos o multiplicadores (no es solo "un").
function findNumberPhrases(words) {
  const phrases = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const startsPhrase = wordValue(w) !== null
      || ((THOUSANDS.has(w) || MILLIONS.has(w)) && w !== 'k');
    if (!startsPhrase) { i += 1; continue; }

    const start = i;
    let total = 0;
    let current = 0;
    let lastMultiplier = 0;
    let strong = false;
    let sawMultiplierSinceCurrent = false;

    while (i < words.length) {
      const word = words[i];
      const value = wordValue(word);
      if (value !== null) {
        if (/\d/.test(word)) strong = true;
        // Dos números seguidos sin multiplicador ("3 50000") son cifras distintas.
        if (current > 0 && /\d/.test(word) && !sawMultiplierSinceCurrent) break;
        current += value;
        sawMultiplierSinceCurrent = false;
      } else if (THOUSANDS.has(word)) {
        current = (current || 1) * 1000;
        total += current;
        current = 0;
        lastMultiplier = 1000;
        strong = true;
        sawMultiplierSinceCurrent = true;
      } else if (MILLIONS.has(word)) {
        total = (total + (current || 1)) * 1_000_000;
        current = 0;
        lastMultiplier = 1_000_000;
        strong = true;
        sawMultiplierSinceCurrent = true;
      } else if (word === 'medio' || word === 'media') {
        if (current > 0) current += 0.5;
        else if (lastMultiplier) total += lastMultiplier / 2;
        else break;
      } else if (word === 'y' && i + 1 < words.length && isNumberish(words[i + 1])) {
        // "treinta y cinco", "un millón y medio"
      } else {
        break;
      }
      i += 1;
    }

    const value = total + current;
    const onlyArticle = i - start === 1 && ARTICLES.has(words[start]);
    if (value > 0 && !onlyArticle) phrases.push({ start, end: i, value, strong, multiplier: lastMultiplier });
    if (i === start) i += 1;
  }
  return phrases;
}

function pickAmount(phrases, words) {
  if (!phrases.length) return null;
  // Una cifra precedida de "$" o con multiplicador gana; si no, la mayor.
  const scored = phrases.map((p) => ({
    ...p,
    score: (p.strong ? 1 : 0) + (words[p.start - 1] === '$' ? 2 : 0),
  }));
  scored.sort((a, b) => b.score - a.score || b.value - a.value);
  return scored[0];
}

// ---------------------------------------------------------------------------
// Tipo de movimiento

const INCOME_VERBS = ['me pagaron', 'me pago', 'me consignaron', 'me transfirieron', 'me depositaron',
  'me giraron', 'me entro', 'me entraron', 'me llego', 'me llegaron', 'me regalaron', 'me dieron',
  'me devolvieron', 'recibi', 'cobre', 'gane', 'vendi', 'ingreso', 'ingresaron', 'entraron', 'entro'];
const EXPENSE_VERBS = ['gaste', 'gasto', 'pague', 'compre', 'me cobraron', 'me costo', 'costo',
  'invite', 'di', 'deposite', 'transferi', 'consigne', 'tanquee'];
const INCOME_NOUNS = ['salario', 'sueldo', 'nomina', 'quincena', 'prima', 'cesantias', 'mesada'];

function firstIndexOf(text, phrases) {
  let best = Infinity;
  for (const p of phrases) {
    const m = new RegExp(`(^|\\s)${p}(\\s|$)`).exec(text);
    if (m && m.index < best) best = m.index;
  }
  return best;
}

// Devuelve el tipo si la frase lo dice (verbo o palabra clave), o null si no hay pistas.
function typeSignal(normalizedText) {
  const income = firstIndexOf(normalizedText, INCOME_VERBS);
  const expense = firstIndexOf(normalizedText, EXPENSE_VERBS);
  if (income !== expense) return income < expense ? 'income' : 'expense';
  if (firstIndexOf(normalizedText, INCOME_NOUNS) !== Infinity) return 'income';
  return null;
}

export function detectType(normalizedText) {
  return typeSignal(normalizedText) ?? 'expense';
}

// ---------------------------------------------------------------------------
// Categoría

function keywordMatches(words, keyword) {
  const parts = keyword.split(' ');
  for (let i = 0; i + parts.length <= words.length; i += 1) {
    const ok = parts.every((part, j) => {
      const w = words[i + j];
      if (j < parts.length - 1 || part.length > 4) return j < parts.length - 1 ? w === part : w.startsWith(part);
      return w === part || w === `${part}s` || w === `${part}es`;
    });
    if (ok) return i;
  }
  return -1;
}

export function detectCategory(normalizedWords, type) {
  let best = null;
  for (const cat of categoriesFor(type)) {
    for (const kw of cat.keywords) {
      const pos = keywordMatches(normalizedWords, kw);
      if (pos >= 0 && (!best || pos < best.pos)) best = { pos, id: cat.id };
    }
  }
  return best ? best.id : defaultCategory(type);
}

// ---------------------------------------------------------------------------
// Medio de pago y fecha

const PAYMENT_KEYWORDS = {
  efectivo: 'efectivo', cash: 'efectivo', nequi: 'nequi', daviplata: 'daviplata',
  transferencia: 'transferencia', pse: 'transferencia', debito: 'debito', credito: 'credito',
};

function detectPayment(words, used) {
  const LINKS = ['con', 'en', 'por', 'la', 'mi', 'de', 'el', 'a', 'al', 'una'];
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    let method = PAYMENT_KEYWORDS[w];
    let end = i + 1;
    if (w === 'tarjeta') {
      method = 'debito';
      const next = words[i + 1] === 'de' ? i + 2 : i + 1;
      if (words[next] === 'credito' || words[next] === 'debito') {
        method = words[next];
        end = next + 1;
      }
    }
    if (!method) continue;
    let start = i;
    while (start > 0 && LINKS.includes(words[start - 1])) start -= 1;
    // "pagué la tarjeta de crédito" o "cuota del crédito" son el gasto, no el medio de pago.
    const ambiguous = w === 'tarjeta' || w === 'credito' || w === 'debito';
    const introduced = words.slice(start, i).some((x) => x === 'con' || x === 'en' || x === 'por');
    if (ambiguous && !introduced) continue;
    for (let k = start; k < end; k += 1) used.add(k);
    return method;
  }
  return null;
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function detectDate(words, used, now) {
  const d = new Date(now);
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    let offset = null;
    if (w === 'hoy') offset = 0;
    else if (w === 'ayer' && words[i - 1] === 'de' && words[i - 2] === 'antes') {
      offset = -2;
      used.add(i - 1); used.add(i - 2);
    } else if (w === 'ayer') offset = -1;
    else if (w === 'anteayer' || w === 'antier') offset = -2;
    if (offset !== null) {
      used.add(i);
      d.setDate(d.getDate() + offset);
      return { date: isoDate(d), explicit: true };
    }
  }
  return { date: isoDate(d), explicit: false };
}

// ---------------------------------------------------------------------------
// Descripción

const FILLER = new Set(['me', 'de', 'del', 'en', 'por', 'para', 'el', 'la', 'los', 'las', 'un', 'una',
  'unos', 'unas', 'y', 'a', 'al', 'que', 'mi', 'mis', 'lo', 'con', 'se', 'fue', 'fueron', 'le', 'les']);
const REMOVABLE = new Set(['gaste', 'gasto', 'pague', 'compre', 'cobraron', 'costo', 'invite', 'pagaron',
  'pago', 'consignaron', 'transfirieron', 'depositaron', 'giraron', 'entro', 'entraron', 'llego',
  'llegaron', 'recibi', 'cobre', 'gane', 'ingreso', 'ingresaron', 'pesos', 'peso', 'cop', '$',
  'dolares', 'usd', 'como', 'aproximadamente', 'unos', 'total', 'valor', 'tanquee', 'di',
  'invite', 'deposite', 'transferi', 'consigne', 'devolvieron', 'regalaron', 'dieron', 'vendi']);

function buildDescription(originalWords, normalizedWords, used) {
  const kept = [];
  for (let i = 0; i < originalWords.length; i += 1) {
    if (used.has(i)) { kept.push(null); continue; }
    if (REMOVABLE.has(normalizedWords[i])) { kept.push(null); continue; }
    kept.push(i);
  }
  // Tramos de palabras contiguas que sobrevivieron; nos quedamos con el más largo
  // en contenido para evitar descripciones como "de con".
  const spans = [];
  let current = [];
  for (const idx of kept) {
    if (idx === null) { if (current.length) spans.push(current); current = []; } else current.push(idx);
  }
  if (current.length) spans.push(current);
  const trimmed = spans
    .map((span) => {
      let s = span;
      while (s.length && FILLER.has(normalizedWords[s[0]])) s = s.slice(1);
      while (s.length && FILLER.has(normalizedWords[s[s.length - 1]])) s = s.slice(0, -1);
      return s;
    })
    .filter((s) => s.length);
  if (!trimmed.length) return '';
  const text = trimmed.map((s) => s.map((i) => originalWords[i]).join(' ')).join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------

function tokenize(text) {
  return text
    .replace(/[¿¡!?;:"“”()]/g, ' ')
    .replace(/\$\s*/g, ' $ ')
    // "25k", "25mil" → "25 k", "25 mil"
    .replace(/(\d)(k|mil|millones|millon|millón|lucas|palos)\b/gi, '$1 $2')
    .split(/\s+/)
    .map((w) => w.replace(/^[.,]+|[.,]+$/g, ''))
    .filter(Boolean);
}

function analyze(text, now) {
  const raw = text.trim();
  const originalWords = tokenize(raw);
  const words = originalWords.map(normalize);
  const used = new Set();

  const signal = typeSignal(words.join(' '));
  const type = signal ?? 'expense';

  const phrase = pickAmount(findNumberPhrases(words), words);
  let amount = null;
  if (phrase) {
    amount = Math.round(phrase.value * 100) / 100;
    for (let i = phrase.start; i < phrase.end; i += 1) used.add(i);
  }

  const paymentMethod = detectPayment(words, used);
  const { date, explicit: dateExplicit } = detectDate(words, used, now);

  const description = buildDescription(originalWords, words, used);
  const categoryWords = words.filter((_, i) => !used.has(i));
  const category = detectCategory(categoryWords, type);

  return {
    tx: { type, amount, category, description, date, paymentMethod, raw },
    meta: {
      typeExplicit: signal !== null,
      dateExplicit,
      multiplier: phrase?.multiplier ?? 0,
      // Cifra que claramente es dinero: grande, con "mil"/"millones" o con "$".
      clearAmount: Boolean(phrase && (phrase.value >= 1000 || phrase.multiplier || words[phrase.start - 1] === '$')),
      nextWord: phrase ? words[phrase.end] ?? null : null,
      categoryWords,
    },
  };
}

/**
 * Convierte una frase libre en un movimiento.
 * @returns {{type:'income'|'expense', amount:number|null, category:string,
 *   description:string, date:string, paymentMethod:string|null, raw:string}}
 */
export function parseTransaction(text, now = new Date()) {
  return analyze(text, now).tx;
}

const TENS = '(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)';
const UNITS_RE = '(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)';

// Parte "80 mil de luz y 60 de internet" en frases sueltas, sin romper
// números como "treinta y cinco" o "un millón y medio".
function splitSegments(text) {
  const protectedText = text
    .replace(new RegExp(`\\b${TENS}\\s+y\\s+(?=${UNITS_RE}\\b)`, 'gi'), '$1 Y§ ')
    .replace(/\s+y\s+(?=medi[oa]\b)/gi, ' Y§ ');
  return protectedText
    .split(/[;\n]+|,(?!\d)|\s+(?:y|e|además|ademas|también|tambien|aparte)\s+/i)
    .map((part) => part.replace(/Y§/g, 'y').trim())
    .filter(Boolean);
}

/**
 * Como parseTransaction, pero reconoce varios movimientos en una frase:
 * "pagué 80 mil de luz y 60 de internet" → dos gastos.
 * Siempre devuelve al menos un elemento.
 */
export function parseMany(text, now = new Date()) {
  const segments = splitSegments(text);
  const groups = [];
  let prefix = '';
  let lastMultiplier = 0;
  for (const seg of segments) {
    const { tx, meta } = analyze(seg, now);
    // "60 de internet" después de "80 mil de luz" cuenta como otro monto;
    // "3 pantalones" no (es una cantidad de cosas).
    const inheritsThousands = tx.amount !== null && lastMultiplier === 1000
      && [null, 'de', 'del', 'en', 'por', 'para', 'pa'].includes(meta.nextWord);
    if (meta.clearAmount || inheritsThousands) {
      groups.push(prefix ? `${prefix} ${seg}` : seg);
      prefix = '';
      lastMultiplier = meta.multiplier || lastMultiplier;
    } else if (groups.length) {
      groups[groups.length - 1] += ` y ${seg}`;
    } else {
      prefix = prefix ? `${prefix} y ${seg}` : seg;
    }
  }
  if (groups.length <= 1) return [parseTransaction(text, now)];

  const results = [];
  let prev = null;
  for (const group of groups) {
    const { tx, meta } = analyze(group, now);
    if (prev) {
      if (!meta.typeExplicit && tx.type !== prev.tx.type) {
        tx.type = prev.tx.type;
        tx.category = detectCategory(meta.categoryWords, tx.type);
      }
      if (!meta.dateExplicit) tx.date = prev.tx.date;
      // "80 mil de luz y 60 de internet": el 60 también son miles.
      if (!meta.multiplier && prev.meta.multiplier === 1000 && tx.amount < 1000) tx.amount *= 1000;
    }
    results.push(tx);
    prev = { tx, meta: { ...meta, multiplier: meta.multiplier || prev?.meta.multiplier || 0 } };
  }
  return results;
}
