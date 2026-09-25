import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueRecurring, budgetStatus, monthlyTrend, levelFor } from '../src/planning.js';

const rule = { id: 'r1', type: 'expense', amount: 900000, category: 'hogar', description: 'Arriendo', day: 5, lastMonth: '2026-08' };

test('genera el recurrente cuando llega el día', () => {
  assert.equal(dueRecurring([rule], new Date(2026, 8, 4)).length, 0);
  const due = dueRecurring([rule], new Date(2026, 8, 5));
  assert.equal(due.length, 1);
  assert.equal(due[0].tx.date, '2026-09-05');
  assert.equal(due[0].month, '2026-09');
});

test('recupera los meses que no se abrió la app', () => {
  const due = dueRecurring([{ ...rule, lastMonth: '2026-06' }], new Date(2026, 8, 1));
  assert.deepEqual(due.map((d) => d.month), ['2026-07', '2026-08']);
});

test('día 31 en meses cortos', () => {
  const due = dueRecurring([{ ...rule, day: 31, lastMonth: '2027-01' }], new Date(2027, 1, 28));
  assert.equal(due[0].tx.date, '2027-02-28');
});

test('estado de presupuestos', () => {
  const tx = [
    { type: 'expense', category: 'comida', amount: 450000, date: '2026-09-10' },
    { type: 'expense', category: 'comida', amount: 100000, date: '2026-08-10' },
    { type: 'expense', category: 'transporte', amount: 90000, date: '2026-09-02' },
    { type: 'income', category: 'salario', amount: 2000000, date: '2026-09-01' },
  ];
  const s = budgetStatus({ comida: 500000, transporte: 80000, ocio: 0 }, tx, '2026-09');
  assert.deepEqual(s.map((b) => [b.category, b.spent, b.level]), [['transporte', 90000, 'over'], ['comida', 450000, 'warn']]);
  assert.equal(levelFor(100, 1000), 'ok');
});

test('tendencia de 6 meses', () => {
  const rows = monthlyTrend([
    { type: 'income', amount: 10, date: '2026-09-01' },
    { type: 'expense', amount: 4, date: '2026-04-30' },
    { type: 'expense', amount: 7, date: '2026-03-30' },
  ], '2026-09');
  assert.equal(rows.length, 6);
  assert.equal(rows[0].month, '2026-04');
  assert.equal(rows[0].expense, 4);
  assert.equal(rows[5].income, 10);
});
