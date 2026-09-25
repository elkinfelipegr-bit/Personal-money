// Presupuestos por categoría y movimientos que se repiten cada mes.
// Funciones puras (sin pantalla ni guardado) para poder probarlas.

export function monthOf(date) {
  return date.slice(0, 7);
}

export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(y, m, 1));
}

function daysIn(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Movimientos recurrentes que ya tocan y aún no se han generado.
 * Una regla: {id, type, amount, category, description, paymentMethod, day,
 *   lastMonth: 'YYYY-MM' (último mes generado)}.
 * Devuelve [{ruleId, month, tx}] en orden; el que llama actualiza lastMonth.
 */
export function dueRecurring(rules, now = new Date()) {
  const current = monthKey(now);
  const due = [];
  for (const rule of rules) {
    let month = nextMonth(rule.lastMonth);
    // Máximo 12 meses hacia atrás, por si la app estuvo mucho tiempo sin abrirse.
    let guard = 0;
    while (month <= current && guard < 12) {
      const day = Math.min(rule.day, daysIn(month));
      if (month === current && now.getDate() < day) break;
      due.push({
        ruleId: rule.id,
        month,
        tx: {
          type: rule.type,
          amount: rule.amount,
          category: rule.category,
          description: rule.description,
          paymentMethod: rule.paymentMethod ?? null,
          date: `${month}-${String(day).padStart(2, '0')}`,
          raw: `Recurrente: ${rule.description || rule.category}`,
          source: 'recurrente',
        },
      });
      month = nextMonth(month);
      guard += 1;
    }
  }
  return due.sort((a, b) => a.tx.date.localeCompare(b.tx.date));
}

export function levelFor(spent, budget) {
  if (!budget) return 'none';
  if (spent > budget) return 'over';
  if (spent >= budget * 0.8) return 'warn';
  return 'ok';
}

/** Estado de cada presupuesto del mes: [{category, budget, spent, pct, level}]. */
export function budgetStatus(budgets, transactions, month) {
  const spentBy = {};
  for (const t of transactions) {
    if (t.type !== 'expense' || monthOf(t.date) !== month) continue;
    spentBy[t.category] = (spentBy[t.category] ?? 0) + t.amount;
  }
  return Object.entries(budgets ?? {})
    .filter(([, budget]) => budget > 0)
    .map(([category, budget]) => {
      const spent = spentBy[category] ?? 0;
      return { category, budget, spent, pct: Math.round((spent / budget) * 100), level: levelFor(spent, budget) };
    })
    .sort((a, b) => b.pct - a.pct);
}

/** Totales de ingresos y gastos de los últimos n meses (el más antiguo primero). */
export function monthlyTrend(transactions, endMonth, n = 6) {
  const [y, m] = endMonth.split('-').map(Number);
  const months = [];
  for (let i = n - 1; i >= 0; i -= 1) months.push(monthKey(new Date(y, m - 1 - i, 1)));
  const rows = months.map((month) => ({ month, income: 0, expense: 0 }));
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  for (const t of transactions) {
    const row = byMonth.get(monthOf(t.date));
    if (row) row[t.type === 'income' ? 'income' : 'expense'] += t.amount;
  }
  return rows;
}
