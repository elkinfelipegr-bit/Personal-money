import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBankMessage, parseBankBatch, messageKey } from '../src/bank.js';

const NOW = new Date(2026, 8, 25, 12, 0, 0);
const bank = (text) => parseBankMessage(text, NOW);

const cases = [
  ['Bancolombia: Compraste $25.000,00 en RAPPI*RESTAURANTE con tu T.Cred *1234, el 24/09/2026 a las 12:30.',
    { type: 'expense', amount: 25000, description: 'Rappi Restaurante', category: 'comida', paymentMethod: 'credito', date: '2026-09-24', bank: 'Bancolombia' }],
  ['Bancolombia le informa Compra por $230.500 en EXITO COLINA 13:05. 23/09/2026 T.Deb *5678. Inquietudes al 018000931987',
    { type: 'expense', amount: 230500, description: 'Exito Colina', category: 'mercado', paymentMethod: 'debito', date: '2026-09-23' }],
  ['Nequi: Pagaste $12.000 en UBER RIDES.',
    { type: 'expense', amount: 12000, description: 'Uber Rides', category: 'transporte', paymentMethod: 'nequi' }],
  ['Nequi: Recibiste $150.000 de JUAN PEREZ.',
    { type: 'income', amount: 150000, description: 'Juan Perez', paymentMethod: 'nequi', category: 'otros_ingresos' }],
  ['Bancolombia le informa Pago de Nomina de ACME SAS por $1.800.000 en su cuenta de ahorros *1234. 15/09/2026',
    { type: 'income', amount: 1800000, category: 'salario', description: 'Acme Sas', date: '2026-09-15' }],
  ['Bancolombia: Retiraste $200.000 en cajero ATM Unicentro de tu cuenta *1234.',
    { type: 'expense', amount: 200000, description: 'Retiro de efectivo', paymentMethod: 'efectivo' }],
  ['Davivienda: Compra aprobada en NETFLIX.COM por $44.900 con tarjeta de credito *9876',
    { type: 'expense', amount: 44900, category: 'suscripciones', paymentMethod: 'credito' }],
  ['Transferiste $80.000 desde tu cuenta *1234 a la cuenta *5678 el 25/09/2026. Bancolombia',
    { type: 'expense', amount: 80000, paymentMethod: 'transferencia' }],
];

for (const [text, expected] of cases) {
  test(text.slice(0, 60), () => {
    const r = bank(text);
    assert.ok(r, 'debería reconocerse como aviso bancario');
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(r[key], value, `${key}: ${JSON.stringify(r)}`);
    }
  });
}

test('las frases normales no son avisos del banco', () => {
  assert.equal(bank('gasté 25 mil en almuerzo'), null);
  assert.equal(bank('taxi $12.000'), null);
  assert.equal(bank('pago de la luz $80.000'), null);
  assert.equal(bank('Hola, ¿cómo vas?'), null);
});

test('varios avisos pegados juntos', () => {
  const text = `Nequi: Pagaste $12.000 en UBER RIDES.
Bancolombia: Compraste $25.000,00 en RAPPI*RESTAURANTE con tu T.Cred *1234, el 24/09/2026 a las 12:30.

Bancolombia le informa Pago de Nomina de ACME SAS
por $1.800.000 en su cuenta de ahorros *1234.
esto no es un aviso`;
  const list = parseBankBatch(text, NOW);
  assert.deepEqual(list.map((t) => t.amount), [12000, 25000, 1800000]);
  assert.equal(list[2].type, 'income');
});

test('huella estable para evitar duplicados', () => {
  assert.equal(messageKey('Nequi: Pagaste  $12.000 en UBER'), messageKey('nequi: pagaste $12.000 en uber'));
});
